import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlayer } from '../dist/player-controller.js';
const tick = async () => { await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); };
class Lock {
  active = false; queue = [];
  request(_name, options, callback) {
    if (options.ifAvailable) return Promise.resolve().then(() => callback(this.active ? null : { name: 'dial' }));
    return new Promise((resolve, reject) => {
      const job = { callback, resolve, reject, signal: options.signal };
      options.signal?.addEventListener('abort', () => { if (!job.started) { this.queue = this.queue.filter(x => x !== job); reject(new Error('aborted')); } }, { once: true });
      this.queue.push(job); this.pump();
    });
  }
  pump() { if (this.active || !this.queue.length) return; const job = this.queue.shift(); if (job.signal?.aborted) { job.reject(new Error('aborted')); this.pump(); return; } this.active = true; job.started = true; Promise.resolve().then(() => job.callback({ name: 'dial' })).then(job.resolve, job.reject).finally(() => { this.active = false; this.pump(); }); }
}
class Bus { peers = new Set(); channel() { const peer = { onmessage: null, postMessage: message => { for (const other of this.peers) if (other !== peer) queueMicrotask(() => other.onmessage?.({ data: message })); }, close: () => this.peers.delete(peer) }; this.peers.add(peer); return peer; } }
class Node extends EventTarget { dataset = {}; textContent = ''; paused = true; src = ''; error = null; playCalls = 0; setAttribute() {} removeAttribute() { this.src = ''; } load() {} pause() { this.paused = true; this.dispatchEvent(new Event('pause')); } play() { this.playCalls++; this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); } click() { this.dispatchEvent(new Event('click')); } }
const setup = shared => { const audio = new Node(), toggle = new Node(), status = new Node(); const player = installPlayer(audio, toggle, status, { coordination: { locks: shared.lock, channel: () => shared.bus.channel() } }); return { audio, toggle, status, player }; };
test('Media Session pauses owner, resumes only when idle, and stale cleanup preserves a newer registration', async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousMetadata = Object.getOwnPropertyDescriptor(globalThis, 'MediaMetadata');
  const session = { handlers: {}, playbackState: 'none', metadata: null, setActionHandler(name, handler) { this.handlers[name] = handler; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaSession: session } });
  Object.defineProperty(globalThis, 'MediaMetadata', { configurable: true, value: class { constructor(value) { Object.assign(this, value); } } });
  const shared = { lock: new Lock(), bus: new Bus() }; let a, b;
  try {
    a = setup(shared); b = setup(shared);
    a.player.selectStation({ id: 'a', name: 'A', streamUrl: 'https://example.test/a' });
    b.player.selectStation({ id: 'b', name: 'B', streamUrl: 'https://example.test/b' });
    a.toggle.click(); await tick();
    assert.equal(session.playbackState, 'playing');
    assert.equal(session.metadata.title, 'A');
    session.handlers.pause(); await tick();
    assert.equal(a.audio.paused, true);
    assert.equal(session.playbackState, 'paused');
    session.handlers.play(); await tick();
    assert.equal(a.audio.paused, false, 'media Play resumes the matching paused source when lock is idle');
    session.handlers.pause(); await tick();
    const stalePlay = session.handlers.play;
    b.toggle.click(); await tick();
    assert.equal(b.audio.paused, false);
    const aCalls = a.audio.playCalls;
    stalePlay(); await tick();
    assert.equal(a.audio.playCalls, aCalls, 'stale media handler cannot take another owner');
    a.player.dispose();
    assert.equal(session.metadata.title, 'B', 'old teardown cannot clear newer Media Session metadata');
  } finally { a?.player.dispose(); b?.player.dispose(); if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator; if (previousMetadata) Object.defineProperty(globalThis, 'MediaMetadata', previousMetadata); else delete globalThis.MediaMetadata; }
});
