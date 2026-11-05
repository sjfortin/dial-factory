import { App } from '@modelcontextprotocol/ext-apps';

const VERSION = 'dial-capability-probe-v1';
const RESOURCE = 'ui://dial/capability-probe-v1.html';
const CHANNEL = 'dial-probe-channel-v1';
const LOCK = 'dial-playback-v1';
const id = crypto.randomUUID();
const shortId = id.slice(0, 8);
const $ = (key: string) => document.getElementById(key)!;
const audio = $('radio') as HTMLAudioElement;
const events: Array<Record<string, unknown>> = [];
const pending = new Map<string, number>();
let channel: BroadcastChannel | null = null;
let releaseLock: (() => void) | null = null;
let holding = false;
let playback = false;
let busy = false;
let peer: string | null = null;

function record(kind: string, detail: Record<string, unknown> = {}) {
  events.push({ at: new Date().toISOString(), kind, ...detail });
  const has = (name: string, predicate: (event: Record<string, unknown>) => boolean = () => true) => events.some(event => event.kind === name && predicate(event));
  const mark = (yes: boolean) => yes ? 'OBSERVED' : 'PENDING';
  $('checks').textContent = [
    `Two-way nonce: ${mark(has('nonce-roundtrip-pass'))} (check both frames)`,
    `Exclusive contention: ${mark(has('contention-check', event => event.acquired === false))}`,
    `Release recovery: ${mark(has('contention-check', event => event.acquired === true))}`,
    `Post-await play(): ${has('post-await-play-rejected') ? 'FAILED' : mark(has('post-await-play-resolved'))}`,
    `Audible radio: ${has('audible-observation', event => event.heard === false) ? 'FAILED' : mark(has('audible-observation', event => event.heard === true))}`,
    'Host gate needs both real ChatGPT frame logs and manual review.'
  ].join('\n');
  ($('results') as HTMLTextAreaElement).value = JSON.stringify({ version: VERSION, resource: RESOURCE, channel: CHANNEL, lock: LOCK, instance: id, browser: navigator.userAgent, origin: location.origin, href: location.href, events }, null, 2);
}
function state(message: string) { $('state').textContent = message; }
function send(type: string, extra: Record<string, unknown> = {}) {
  if (!channel) { record('message-unavailable', { type }); return; }
  channel.postMessage({ version: VERSION, from: id, type, ...extra });
  record('message-sent', { type, to: peer ?? 'unknown', ...extra });
}
function stop(reason: string) {
  audio.pause();
  playback = false;
  if (releaseLock) { const resolve = releaseLock; releaseLock = null; resolve(); }
  holding = false;
  state(`Stopped: ${reason}`);
  record('stopped-and-released', { reason });
}
function onMessage(event: MessageEvent) {
  const m = event.data;
  if (!m || typeof m !== 'object' || m.version !== VERSION || typeof m.from !== 'string' || m.from === id) return;
  if (!['hello', 'nonce', 'nonce-ack', 'transfer-request', 'transfer-ack'].includes(m.type)) return;
  peer = m.from;
  $('identity').textContent = `Frame ${shortId} · peer ${m.from.slice(0, 8)} · ${RESOURCE} · ${location.origin}`;
  record('message-received', { type: m.type, from: m.from, nonce: m.nonce ?? null });
  if (m.type === 'hello') state(`Peer seen: ${m.from.slice(0, 8)}`);
  if (m.type === 'nonce' && typeof m.nonce === 'string') send('nonce-ack', { nonce: m.nonce });
  if (m.type === 'nonce-ack' && typeof m.nonce === 'string' && pending.has(m.nonce)) {
    record('nonce-roundtrip-pass', { nonce: m.nonce, peer: m.from, elapsedMs: performance.now() - pending.get(m.nonce)! });
    pending.delete(m.nonce);
    state(`Nonce returned by ${m.from.slice(0, 8)}`);
  }
  if (m.type === 'transfer-request' && holding) {
    stop(`transfer requested by ${m.from.slice(0, 8)}`);
    send('transfer-ack', { request: m.request });
  }
}
function requestLock(timeoutMs: number, callback: () => Promise<void> | void): Promise<'acquired' | 'unavailable'> {
  if (!navigator.locks) return Promise.resolve('unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return navigator.locks.request(LOCK, { mode: 'exclusive', signal: controller.signal }, async () => {
    clearTimeout(timer);
    holding = true;
    record('lock-acquired');
    const released = new Promise<void>((resolve) => { releaseLock = resolve; });
    try { await callback(); } catch (error) { record('lock-callback-error', { error: String(error) }); stop('lock callback error'); }
    await released;
    holding = false;
    record('lock-released');
  }).then(() => 'acquired' as const, (error: unknown) => {
    record('lock-request-failed', { name: error instanceof Error ? error.name : String(error) });
    return 'unavailable' as const;
  }).finally(() => clearTimeout(timer));
}
function runButton(key: string, action: () => Promise<void> | void) {
  $(key).addEventListener('click', () => { void action(); });
}
record('mounted', { channelAvailable: typeof BroadcastChannel !== 'undefined', locksAvailable: !!navigator.locks, visibility: document.visibilityState });
$('identity').textContent = `Frame ${shortId} · ${RESOURCE} · ${location.origin}`;
if (typeof BroadcastChannel !== 'undefined') {
  try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = onMessage; send('hello'); }
  catch (error) { record('channel-open-failed', { error: String(error) }); }
}
state(channel && navigator.locks ? 'Ready: use both frames to test' : 'Missing BroadcastChannel or Web Locks; coordination gate fails here');
runButton('nonce', () => {
  const nonce = crypto.randomUUID();
  pending.set(nonce, performance.now());
  send('nonce', { nonce });
  setTimeout(() => { if (pending.delete(nonce)) { record('nonce-timeout', { nonce }); state('No nonce reply within 3 seconds'); } }, 3000);
});
runButton('hold', async () => {
  if (busy || holding) return;
  busy = true;
  state('Waiting for exclusive lock…');
  record('hold-requested');
  const result = await requestLock(4000, () => state('Holding exclusive lock; check contention in other frame'));
  if (result === 'unavailable') state('Could not acquire lock within 4 seconds');
  busy = false;
});
runButton('contend', async () => {
  if (!navigator.locks) { record('contention-unavailable'); state('Web Locks unavailable'); return; }
  try {
    const acquired = await navigator.locks.request(LOCK, { mode: 'exclusive', ifAvailable: true }, (lock) => !!lock);
    record('contention-check', { acquired, peer, interpretation: acquired ? 'No holder in this lock scope at this instant' : 'Another holder blocks this lock scope' });
    state(acquired ? 'Lock was available. If other frame holds it, scope is NOT shared.' : 'Lock blocked by another holder. Shared exclusion observed.');
  } catch (error) { record('contention-error', { error: String(error) }); state('Lock check errored'); }
});
runButton('transfer', async () => {
  if (busy || holding) return;
  busy = true;
  const request = crypto.randomUUID();
  const clickedAt = performance.now();
  record('transfer-click', { request, peer, visibility: document.visibilityState });
  send('transfer-request', { request });
  state('Waiting for old holder to pause and release…');
  const result = await requestLock(5000, async () => {
    record('post-await-play-call', { request, elapsedMs: performance.now() - clickedAt, visibility: document.visibilityState });
    try {
      await audio.play();
      playback = true;
      record('post-await-play-resolved', { request, paused: audio.paused });
      state('Radio Paradise play() resolved. Confirm audible sound.');
    } catch (error) {
      record('post-await-play-rejected', { request, error: String(error) });
      state('Audio play() rejected after transfer');
      stop('play rejected');
    }
  });
  if (result === 'unavailable') { record('transfer-failed', { request }); state('Transfer failed: exclusive lock not acquired'); }
  busy = false;
});
runButton('release', () => stop('user clicked pause/release'));
runButton('heard', () => { record('audible-observation', { heard: true, playback }); state('Audible radio marked yes in results'); });
runButton('silent', () => { record('audible-observation', { heard: false, playback }); state('Audible radio marked no in results'); });
runButton('copy', async () => {
  const value = ($('results') as HTMLTextAreaElement).value;
  try { await navigator.clipboard.writeText(value); state('Results copied'); }
  catch { ($('results') as HTMLTextAreaElement).select(); state('Select and copy the results text'); }
});
document.addEventListener('visibilitychange', () => record('visibility-change', { visibility: document.visibilityState }));
window.addEventListener('pagehide', () => { stop('pagehide'); channel?.close(); record('pagehide'); });
audio.addEventListener('error', () => { record('audio-error', { code: audio.error?.code }); if (playback) stop('audio error'); });
const app = new App({ name: 'dial-capability-probe', version: '1.0.0' });
void app.connect().then(() => record('app-connected'), (error) => record('app-connect-failed', { error: String(error) }));
