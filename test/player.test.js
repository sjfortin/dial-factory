import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlayer } from '../dist/player-controller.js';

class ElementDouble extends EventTarget {
  dataset = {}; textContent = ''; hidden = false; disabled = false; attributes = {};
  setAttribute(name, value) { this.attributes[name] = value; }
  fire(name) { this.dispatchEvent(new Event(name)); }
}

class SharedLock {
  queue = []; active = false;
  request(_name, { signal }, callback) {
    return new Promise((resolve, reject) => {
      const item = { callback, resolve, reject, signal };
      if (signal.aborted) { reject(new Error('aborted')); return; }
      signal.addEventListener('abort', () => {
        if (!item.started) { this.queue = this.queue.filter((x) => x !== item); reject(new Error('aborted')); }
      }, { once: true });
      this.queue.push(item); this.pump();
    });
  }
  pump() {
    if (this.active || !this.queue.length) return;
    const item = this.queue.shift();
    if (item.signal.aborted) { item.reject(new Error('aborted')); this.pump(); return; }
    this.active = true; item.started = true;
    Promise.resolve().then(item.callback).then(item.resolve, item.reject).finally(() => {
      this.active = false; this.pump();
    });
  }
}

class Bus {
  peers = new Set(); messages = [];
  channel() {
    const peer = { onmessage: null, postMessage: (message) => {
      this.messages.push(message);
      for (const other of this.peers) if (other !== peer) queueMicrotask(() => other.onmessage?.({ data: message }));
    }, close: () => this.peers.delete(peer) };
    this.peers.add(peer); return peer;
  }
}
const settle = async () => { await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve)); };

function setup(shared, name = 'Station', reports = []) {
  const audio = new ElementDouble();
  const toggle = new ElementDouble();
  const status = new ElementDouble();
  const remoteButton = new ElementDouble();
  const remoteStatus = new ElementDouble();
  audio.src = `https://example.com/${name}`; audio.error = null; audio.playCalls = 0; audio.pauseCalls = 0; audio.isPlaying = false; audio.paused = true;
  audio.play = () => { audio.playCalls++; audio.isPlaying = true; audio.paused = false; audio.fire('playing'); return Promise.resolve(); };
  audio.pause = () => { audio.pauseCalls++; audio.isPlaying = false; audio.paused = true; audio.fire('pause'); };
  audio.load = () => { audio.error = null; };
  audio.removeAttribute = () => { audio.src = ''; };
  const player = installPlayer(audio, toggle, status, {
    coordination: { locks: shared.lock, channel: () => shared.bus.channel() }, remoteButton, remoteStatus,
    onPlaying: (token) => reports.push(token)
  });
  return { audio, toggle, status, remoteButton, remoteStatus, player };
}
function shared() { return { lock: new SharedLock(), bus: new Bus() }; }

test('missing coordination fails closed without calling audio.play', async () => {
  const s = setup({ lock: undefined, bus: new Bus() });
  s.toggle.fire('click'); await settle();
  assert.equal(s.audio.playCalls, 0);
  assert.equal(s.status.dataset.state, 'error');
  assert.match(s.status.textContent, /cannot coordinate/);
  s.player.dispose();
});

test('two players transfer only after old audio pauses; remote Pause confirms after stopping', async () => {
  const env = shared(); const reports = [];
  const a = setup(env, 'A', reports); const b = setup(env, 'B', reports);
  a.player.selectStation({ id: 'a', name: 'A', streamUrl: 'https://example.com/a', clickToken: 'a' });
  b.player.selectStation({ id: 'b', name: 'B', streamUrl: 'https://example.com/b', clickToken: 'b' });
  a.toggle.fire('click'); await settle();
  assert.equal(a.audio.isPlaying, true);
  assert.equal(b.remoteButton.hidden, false);
  b.toggle.fire('click'); await settle();
  assert.equal(a.audio.isPlaying, false);
  assert.equal(b.audio.isPlaying, true);
  assert.match(a.status.textContent, /another thread/);
  assert.deepEqual(reports, ['a', 'b']);
  a.remoteButton.fire('click'); await settle();
  assert.equal(b.audio.isPlaying, false);
  assert.match(a.remoteStatus.textContent, /Paused in another thread/);
  assert.equal(env.lock.active, false);
  a.player.dispose(); b.player.dispose();
});

test('simultaneous Play and cancellation never overlap or report canceled start', async () => {
  const env = shared(); const reports = [];
  const a = setup(env, 'A', reports); const b = setup(env, 'B', reports);
  a.player.selectStation({ id: 'a', name: 'A', streamUrl: 'https://example.com/a', clickToken: 'a' });
  b.player.selectStation({ id: 'b', name: 'B', streamUrl: 'https://example.com/b', clickToken: 'b' });
  const originalA = a.audio.play;
  a.audio.play = () => { assert.equal(b.audio.isPlaying, false); return originalA(); };
  const originalB = b.audio.play;
  b.audio.play = () => { assert.equal(a.audio.isPlaying, false); return originalB(); };
  a.toggle.fire('click'); b.toggle.fire('click'); await settle();
  assert.equal(Number(a.audio.isPlaying) + Number(b.audio.isPlaying), 1);
  // A new source selection invalidates a waiting attempt and cannot start old audio.
  a.player.selectStation({ id: 'new', name: 'New', streamUrl: 'https://example.com/new' });
  await settle();
  assert.equal(a.audio.isPlaying, false);
  assert.equal(a.status.dataset.state, 'idle');
  assert.ok(reports.length <= 2);
  a.player.dispose(); b.player.dispose();
});

test('unresponsive holder keeps contender silent; canceled waiter cannot start later', async () => {
  const env = shared(); const a = setup(env, 'A'); const b = setup(env, 'B');
  a.toggle.fire('click'); await settle();
  // Drop owner-bound messages while its lock is held.
  const owner = [...env.bus.peers][0]; owner.onmessage = null;
  b.toggle.fire('click'); await settle();
  assert.equal(b.audio.playCalls, 0);
  b.toggle.fire('click'); // cancels pending request
  a.toggle.fire('click'); await settle();
  assert.equal(b.audio.playCalls, 0);
  assert.equal(b.status.dataset.state, 'paused');
  a.player.dispose(); b.player.dispose();
});

test('unresponsive owner times out Play and remote Pause without false success', async () => {
  const env = shared();
  const a = setup(env, 'A');
  const b = setup(env, 'B');
  a.toggle.fire('click'); await settle();
  assert.equal(b.remoteButton.hidden, false);
  const owner = [...env.bus.peers][0]; owner.onmessage = null;
  b.remoteButton.fire('click');
  await new Promise((resolve) => setTimeout(resolve, 1900));
  assert.match(b.remoteStatus.textContent, /Could not confirm Pause/);
  assert.equal(a.audio.isPlaying, true);
  b.toggle.fire('click');
  await new Promise((resolve) => setTimeout(resolve, 4600));
  assert.equal(b.audio.playCalls, 0);
  assert.equal(b.status.dataset.state, 'error');
  assert.match(b.status.textContent, /Could not switch playback/);
  a.player.dispose(); b.player.dispose();
});

test('media rejection releases lock and does not report click; remount can acquire', async () => {
  const env = shared(); const reports = []; const a = setup(env, 'A', reports);
  a.player.selectStation({ id: 'a', name: 'A', streamUrl: 'https://example.com/a', clickToken: 'a' });
  a.audio.play = () => Promise.reject(new Error('blocked'));
  a.toggle.fire('click'); await settle();
  assert.equal(a.status.dataset.state, 'error');
  assert.deepEqual(reports, []);
  a.player.dispose();
  const b = setup(env, 'B', reports); b.toggle.fire('click'); await settle();
  assert.equal(b.audio.isPlaying, true);
  b.player.dispose();
});

test('late old play fulfillment and rejection cannot stop or relabel a newer playback', async () => {
  const env = shared(); const a = setup(env);
  const normalPlay = a.audio.play;
  let resolveOld;
  a.audio.play = () => new Promise((resolve) => { resolveOld = resolve; });
  a.toggle.fire('click'); await settle();
  a.toggle.fire('click');
  a.audio.play = normalPlay;
  a.toggle.fire('click'); await settle();
  assert.equal(a.audio.isPlaying, true);
  resolveOld(); await settle();
  assert.equal(a.audio.isPlaying, true);
  assert.equal(a.status.dataset.state, 'playing');

  let rejectOld;
  a.toggle.fire('click');
  a.audio.play = () => new Promise((_resolve, reject) => { rejectOld = reject; });
  a.toggle.fire('click'); await settle();
  a.toggle.fire('click');
  a.audio.play = normalPlay;
  a.toggle.fire('click'); await settle();
  rejectOld(new Error('late')); await settle();
  assert.equal(a.audio.isPlaying, true);
  assert.equal(a.status.dataset.state, 'playing');
  a.player.dispose();
});

test('current media pause releases lock; queued old pause cannot interrupt resumed audio', async () => {
  const env = shared(); const a = setup(env);
  a.toggle.fire('click'); await settle();
  assert.equal(env.lock.active, true);
  a.audio.pause(); await settle();
  assert.equal(env.lock.active, false);
  assert.equal(a.status.dataset.state, 'paused');
  assert.equal(a.toggle.textContent, 'Play');
  a.toggle.fire('click'); await settle();
  assert.equal(a.audio.isPlaying, true);
  a.audio.fire('pause'); // late event from the previous stopped attempt
  assert.equal(a.audio.isPlaying, true);
  assert.equal(a.status.dataset.state, 'playing');
  a.player.dispose();
});

test('retained media error retries through load and reports each confirmed resume once', async () => {
  const env = shared(); const reports = []; const a = setup(env, 'A', reports);
  a.player.selectStation({ id: 'a', name: 'A', streamUrl: 'https://example.com/a', clickToken: 'a' });
  const normalPlay = a.audio.play;
  a.audio.play = () => a.audio.error ? Promise.reject(new Error('retained error')) : normalPlay();
  a.toggle.fire('click'); await settle();
  a.audio.error = { code: 4 };
  a.audio.fire('error'); await settle();
  assert.equal(a.status.dataset.state, 'error');
  a.toggle.fire('click'); await settle();
  assert.equal(a.audio.error, null);
  assert.equal(a.status.dataset.state, 'playing');
  a.audio.fire('playing');
  assert.deepEqual(reports, ['a', 'a']);
  a.toggle.fire('click'); a.toggle.fire('click'); await settle();
  a.audio.fire('playing');
  assert.deepEqual(reports, ['a', 'a', 'a']);
  a.player.dispose();
});

test('late old-source events cannot turn a new idle selection into playback', async () => {
  const env = shared(); const reports = []; const a = setup(env, 'A', reports);
  a.player.selectStation({ id: 'a', name: 'A', streamUrl: 'https://example.com/a', clickToken: 'a' });
  let rejectOld;
  a.audio.play = () => new Promise((_resolve, reject) => { rejectOld = reject; });
  a.toggle.fire('click'); await settle();
  a.player.selectStation({ id: 'b', name: 'B', streamUrl: 'https://example.com/b', clickToken: 'b' });
  rejectOld(new Error('late old source'));
  for (const event of ['playing', 'waiting', 'stalled', 'error']) a.audio.fire(event);
  await settle();
  assert.equal(a.status.dataset.state, 'idle');
  assert.equal(a.audio.src, 'https://example.com/b');
  assert.deepEqual(reports, []);
  a.player.dispose();
});
