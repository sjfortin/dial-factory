import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackCoordinator } from '../dist/playback-coordinator.js';

test('all injected timers keep their provider receiver through acquire, remote Pause, and cleanup', async () => {
  const calls = { setTimeout: 0, clearTimeout: 0, setInterval: 0, clearInterval: 0 };
  const env = {
    id: () => 'local',
    setTimeout(callback, delay) { assert.equal(this, env); calls.setTimeout++; return globalThis.setTimeout(callback, delay); },
    clearTimeout(handle) { assert.equal(this, env); calls.clearTimeout++; globalThis.clearTimeout(handle); },
    setInterval(callback, delay) { assert.equal(this, env); calls.setInterval++; return globalThis.setInterval(callback, delay); },
    clearInterval(handle) { assert.equal(this, env); calls.clearInterval++; globalThis.clearInterval(handle); },
    locks: { request(_name, _options, callback) { return callback(); } }
  };
  const channel = { onmessage: null, sent: [], postMessage(message) { this.sent.push(message); }, close() {} };
  env.channel = () => channel;
  const coordinator = new PlaybackCoordinator(env);
  assert.equal(coordinator.available, true);
  assert.equal(await coordinator.acquire('epoch-local', 'Station', new AbortController().signal), true);
  coordinator.release();
  channel.onmessage({ data: { v: 1, type: 'status', sender: 'other', epoch: 'epoch-other', station: 'Other', active: true } });
  const paused = coordinator.pauseRemote();
  const request = channel.sent.findLast((message) => message.type === 'pause').request;
  channel.onmessage({ data: { v: 1, type: 'ack', sender: 'other', target: 'local', epoch: 'epoch-other', request } });
  assert.equal(await paused, true);
  coordinator.dispose();
  assert.ok(calls.setTimeout >= 2, 'lock wait and remote Pause set timers');
  assert.ok(calls.clearTimeout >= 2, 'both pending timers were cleared');
  assert.ok(calls.setInterval >= 3, 'stale status, transfer poll, and heartbeat set intervals');
  assert.ok(calls.clearInterval >= 3, 'all intervals were cleared');
});
