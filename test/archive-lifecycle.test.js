import test from 'node:test';
import assert from 'node:assert/strict';
import Hls from 'hls.js/light';
import { installPlayer } from '../dist/player-controller.js';
const tick = async () => { await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); };
class El extends EventTarget {
  dataset = {}; textContent = ''; hidden = false; disabled = false; value = '0'; error = null; paused = true; currentTime = 0; duration = 100; readyState = 0; _src = ''; playCalls = 0;
  ranges = [[10, 40], [60, 90]];
  get src() { return this._src; } set src(value) { this._src = value; this.currentTime = 0; this.readyState = 1; this.dispatchEvent(new Event('loadedmetadata')); }
  get seekable() { return { length: this.ranges.length, start: i => this.ranges[i][0], end: i => this.ranges[i][1] }; }
  setAttribute() {} removeAttribute(name) { if (name === 'src') this._src = ''; }
  load() { this.error = null; this.currentTime = 0; this.readyState = 0; }
  canPlayType() { return ''; }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  play() { this.playCalls++; this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  click() { this.dispatchEvent(new Event('click')); }
}
class Lock {
  active = false; queue = []; delayedClaim = null;
  request(_name, options, callback) {
    if (options.ifAvailable) {
      if (this.delayedClaim) return new Promise((resolve, reject) => this.delayedClaim.push({ callback, resolve, reject }));
      return Promise.resolve().then(() => callback(this.active ? null : { name: 'dial' }));
    }
    return new Promise((resolve, reject) => { const job = { callback, resolve, reject, signal: options.signal }; options.signal?.addEventListener('abort', () => { if (!job.started) { this.queue = this.queue.filter(x => x !== job); reject(new Error('aborted')); } }, { once: true }); this.queue.push(job); this.pump(); });
  }
  pump() { if (this.active || !this.queue.length) return; const job = this.queue.shift(); if (job.signal?.aborted) { job.reject(new Error('aborted')); this.pump(); return; } this.active = true; job.started = true; Promise.resolve().then(() => job.callback({ name: 'dial' })).then(job.resolve, job.reject).finally(() => { this.active = false; this.pump(); }); }
}
class Bus { peers = new Set(); channel() { const peer = { onmessage: null, postMessage: message => { for (const other of this.peers) if (other !== peer) queueMicrotask(() => other.onmessage?.({ data: message })); }, close: () => this.peers.delete(peer) }; this.peers.add(peer); return peer; } }
const archive = { id: 'archive-a', name: 'Archive A', source: 'nts', streamUrl: '', archive: { showAlias: 'a', episodeAlias: 'a', url: 'https://www.nts.live/shows/a/episodes/a' } };
const setup = (shared, overrides = {}) => { const audio = new El(), toggle = new El(), status = new El(), seek = new El(); const player = installPlayer(audio, toggle, status, { coordination: { locks: shared.lock, channel: () => shared.bus.channel() }, seek, ...overrides }); return { audio, toggle, status, seek, player }; };
const shared = () => ({ lock: new Lock(), bus: new Bus() });
test('archive failure invalidates signed candidate, while pause keeps it for a bounded lifetime', async () => {
  const env = shared(); let resolutions = 0; const s = setup(env, { resolveArchive: async () => { resolutions++; return { format: 'direct', url: 'https://playback.media-streaming.soundcloud.cloud/test.mp3' }; } });
  const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
  try {
    s.player.selectStation(archive); s.toggle.click(); await tick(); assert.equal(resolutions, 1);
    s.audio.currentTime = 25; s.audio.error = { code: 2 }; s.audio.dispatchEvent(new Event('error')); await tick();
    s.toggle.click(); await tick(); assert.equal(resolutions, 2, 'error Retry obtains a fresh candidate even without expires');
    s.toggle.click(); await tick(); s.toggle.click(); await tick(); assert.equal(resolutions, 2, 'ordinary pause/resume reuses a valid candidate');
    s.toggle.click(); await tick(); now += 5 * 60 * 1000 + 1; s.toggle.click(); await tick();
    assert.equal(resolutions, 3, 'five-minute age forces a new resolution');
  } finally { Date.now = originalNow; s.player.dispose(); }
});
test('seek and position restore stay inside offset and disjoint seekable ranges after remote Pause', async () => {
  const env = shared(); let resolutions = 0; const a = setup(env, { resolveArchive: async () => { resolutions++; return { format: 'direct', url: 'https://playback.media-streaming.soundcloud.cloud/test.mp3' }; } }); const b = setup(env);
  try {
    a.player.selectStation(archive); a.toggle.click(); await tick();
    assert.equal(a.seek.min, '10'); assert.equal(a.seek.max, '40');
    a.seek.value = '0'; a.seek.dispatchEvent(new Event('input')); assert.equal(a.audio.currentTime, 10);
    a.seek.value = '50'; a.seek.dispatchEvent(new Event('input')); assert.equal(a.audio.currentTime, 40, 'gap seek clamps to nearest valid boundary');
    a.audio.currentTime = 72; a.audio.dispatchEvent(new Event('timeupdate'));
    assert.equal(a.seek.min, '60'); assert.equal(a.seek.max, '90');
    assert.equal(await b.player.pauseRemote(), true); await tick();
    assert.equal(a.audio.currentTime, 0, 'source cleanup clears the element');
    a.toggle.click(); await tick();
    assert.equal(resolutions, 2, 'remote ownership stop re-resolves the archive');
    assert.equal(a.audio.currentTime, 72, 'loadedmetadata restores the saved position in the second range');
  } finally { a.player.dispose(); b.player.dispose(); }
});
class FakeHls {
  handlers = new Map(); destroyed = false;
  on(name, callback) { const list = this.handlers.get(name) ?? []; list.push(callback); this.handlers.set(name, list); }
  emit(name, data = {}) { for (const callback of this.handlers.get(name) ?? []) callback(name, data); }
  loadSource() {}
  attachMedia(audio) { audio.src = 'blob:fixture'; if (this.autoManifest) queueMicrotask(() => this.emit(Hls.Events.MANIFEST_PARSED)); }
  destroy() { this.destroyed = true; }
}
test('fatal HLS errors before and after manifest become retryable and destroy stale instances', async () => {
  const env = shared(); let resolutions = 0; const instances = []; let autoManifest = false;
  const s = setup(env, { resolveArchive: async () => { resolutions++; return { format: 'hls', url: 'https://playback.media-streaming.soundcloud.cloud/a/playlist.m3u8' }; }, hlsAdapter: { isSupported: () => true, create: () => { const h = new FakeHls(); h.autoManifest = autoManifest; instances.push(h); return h; } } });
  try {
    s.player.selectStation(archive); s.toggle.click(); await tick();
    instances[0].emit(Hls.Events.ERROR, { fatal: true, type: 'networkError' }); await tick();
    assert.equal(s.status.dataset.state, 'error'); assert.equal(instances[0].destroyed, true);
    autoManifest = true; s.toggle.click(); await tick();
    assert.equal(resolutions, 2); assert.equal(s.status.dataset.state, 'playing');
    instances[1].emit(Hls.Events.ERROR, { fatal: true, type: 'mediaError' }); await tick();
    assert.equal(s.status.dataset.state, 'error'); assert.equal(instances[1].destroyed, true);
    s.toggle.click(); await tick(); assert.equal(resolutions, 3);
    instances[1].emit(Hls.Events.ERROR, { fatal: true }); await tick();
    assert.equal(s.status.dataset.state, 'playing', 'stale HLS instance cannot fail the new attempt');
  } finally { s.player.dispose(); }
});
test('expired HLS candidate resolves again and restores position after synchronous metadata', async () => {
  const env = shared(); const originalNow = Date.now; let now = originalNow(), resolutions = 0;
  Date.now = () => now;
  const s = setup(env, { resolveArchive: async () => { resolutions++; return { format: 'hls', url: 'https://playback.media-streaming.soundcloud.cloud/a/playlist.m3u8', expires: Math.floor(now / 1000) + 120 }; }, hlsAdapter: { isSupported: () => true, create: () => { const h = new FakeHls(); h.autoManifest = true; return h; } } });
  try {
    s.player.selectStation(archive); s.toggle.click(); await tick();
    s.audio.currentTime = 72; s.toggle.click(); await tick();
    now += 70 * 1000; s.toggle.click(); await tick();
    assert.equal(resolutions, 2);
    assert.equal(s.audio.currentTime, 72);
    assert.equal(s.status.dataset.state, 'playing');
  } finally { Date.now = originalNow; s.player.dispose(); }
});
test('late media-key claim cannot relabel or release a newer source', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); const originalMetadata = Object.getOwnPropertyDescriptor(globalThis, 'MediaMetadata');
  const session = { handlers: {}, metadata: null, playbackState: 'none', setActionHandler(name, handler) { this.handlers[name] = handler; } };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaSession: session } });
  Object.defineProperty(globalThis, 'MediaMetadata', { configurable: true, value: class { constructor(value) { Object.assign(this, value); } } });
  const env = shared(); const s = setup(env);
  try {
    s.player.selectStation({ id: 'live-a', name: 'Live A', streamUrl: 'https://example.test/a' }); s.toggle.click(); await tick();
    s.toggle.click(); await tick(); env.lock.delayedClaim = [];
    session.handlers.play(); await tick(); assert.equal(env.lock.delayedClaim.length, 1);
    s.player.selectStation({ id: 'live-b', name: 'Live B', streamUrl: 'https://example.test/b' }); s.toggle.click(); await tick();
    const claim = env.lock.delayedClaim.shift(); await claim.callback(null); claim.resolve(); await tick();
    assert.equal(s.status.dataset.state, 'playing'); assert.equal(s.audio.src, 'https://example.test/b'); assert.equal(env.lock.active, true);
  } finally { s.player.dispose(); if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator; if (originalMetadata) Object.defineProperty(globalThis, 'MediaMetadata', originalMetadata); else delete globalThis.MediaMetadata; }
});
