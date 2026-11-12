import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

class Element extends EventTarget {
  children = []; textContent = ''; dataset = {}; attributes = {}; disabled = false; hidden = false; src = ''; value = ''; error = null; pauseCalls = 0; playCalls = 0;
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelectorAll(selector) { return selector === 'button.station-option' ? this.children.map(item => item.children[0]) : selector === '.nts-option' ? this.children : []; }
  querySelector() { return null; }
  focus() {}
  removeAttribute(key) { if (key === 'src') this.src = ''; }
  pause() { this.pauseCalls++; this.dispatchEvent(new Event('pause')); }
  load() { this.error = null; }
  play() { this.playCalls++; this.dispatchEvent(new Event('playing')); return Promise.resolve(); }
  click() { this.dispatchEvent(new Event('click')); }
}
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, countryCode = 'FR') => ({ id: id(n), name: `Station ${n}`, countryCode, streamUrl: `https://audio.bfmtv.com/${n}.mp3`, origin: 'https://audio.bfmtv.com', codec: 'MP3', clickToken: `token-${n}` });
const windows = partial => [0, 1, 2].map(pageIndex => ({ pageIndex, offset: pageIndex * 50, searchedCount: pageIndex ? 0 : 50, success: !(partial && pageIndex === 1) }));
const result = (stations, { kind = 'initial', countryCode = 'FR', partial = false } = {}) => ({ kind, countryCode, status: 'ok', stations, windows: windows(partial), scanState: partial ? 'partial' : 'complete', choiceLimitReached: false });

export async function exerciseDeliveredScript(script) {
  const nodes = Object.fromEntries(['#radio', '#toggle', '#status', '#stations', '#summary', '#more-stations', '#retry-scan', '#remote-pause', '#remote-status', '#station-title', '#station-subtitle', '#country-select', '#countries-tab', '#nts-tab', '#countries-panel', '#nts-panel', '#country-attribution'].map(id => [id, new Element()]));
  const ntsButtons = [1, 2].map(channel => { const button = new Element(); button.dataset.channel = String(channel); return button; });
  nodes['#nts-panel'].append(...ntsButtons);
  nodes['#toggle'].disabled = true;
  const listeners = new Map(); const sent = []; const delayed = []; const delayedFind = [];
  const reply = (message, structuredContent) => listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, result: { content: [], structuredContent } }, source: window.parent });
  const replyError = message => listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, error: { code: -32000, message: 'Country request failed' } }, source: window.parent });
  const window = { innerWidth: 480, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); }, parent: { postMessage(message) {
    sent.push(message);
    if (message.method === 'ui/initialize') queueMicrotask(() => listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'test-host', version: '1' }, hostCapabilities: {}, hostContext: {} } }, source: window.parent }));
    if (message.method === 'tools/call') queueMicrotask(() => { if (message.params?.name === 'retry_stations_by_country') delayed.push(message); else if (message.params?.name === 'find_stations_by_country') delayedFind.push(message); else reply(message, { counted: true }); });
  } } };
  const document = { querySelector(selector) { return nodes[selector] ?? null; }, createElement() { return new Element(); }, documentElement: { style: { height: '' }, getBoundingClientRect() { return { height: 400 }; } }, body: new Element() };
  class ResizeObserver { observe() {} disconnect() {} }
  class BroadcastChannel { onmessage = null; postMessage() {} close() {} }
  const navigator = { locks: { request(_name, { signal }, callback) { return signal.aborted ? Promise.reject(new Error('aborted')) : Promise.resolve().then(callback); } } };
  runInNewContext(script, { window, document, navigator, BroadcastChannel, console: { ...console, debug() {} }, URL, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, queueMicrotask, requestAnimationFrame: callback => queueMicrotask(callback), ResizeObserver, Event, EventTarget, AbortController, TextEncoder, TextDecoder }, { timeout: 5000 });
  await tick();
  assert.ok(sent.some(item => item.method === 'ui/notifications/initialized'));
  const notify = structuredContent => listeners.get('message')?.({ data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent } }, source: window.parent });
  notify(result(Array.from({ length: 9 }, (_, i) => row(i + 1)), { partial: true }));
  await tick();
  assert.equal(nodes['#stations'].children.length, 8);
  assert.equal(nodes['#more-stations'].hidden, false);
  assert.equal(nodes['#retry-scan'].hidden, false);
  nodes['#stations'].children[0].children[0].click();
  nodes['#toggle'].click(); await tick();
  assert.equal(nodes['#status'].dataset.state, 'playing');
  const source = nodes['#radio'].src, pauses = nodes['#radio'].pauseCalls, calls = sent.filter(item => item.method === 'tools/call').length;
  nodes['#more-stations'].click(); await tick();
  assert.equal(nodes['#stations'].children.length, 9);
  assert.equal(nodes['#more-stations'].hidden, true);
  assert.equal(sent.filter(item => item.method === 'tools/call').length, calls);
  assert.equal(nodes['#radio'].src, source);
  assert.equal(nodes['#radio'].pauseCalls, pauses);
  assert.equal(nodes['#stations'].children[0].children[0].attributes['aria-pressed'], 'true');
  nodes['#retry-scan'].click(); await tick();
  assert.equal(delayed.length, 1);
  notify(result([row(99)], { kind: 'retry' })); await tick();
  assert.equal(nodes['#stations'].children.length, 9, 'uncorrelated retry notification ignored');
  reply(delayed.shift(), result([row(10)], { kind: 'retry' })); await tick();
  assert.equal(nodes['#stations'].children.length, 9, 'new row stays hidden until More');
  assert.equal(nodes['#more-stations'].hidden, false);
  assert.equal(nodes['#retry-scan'].hidden, true);
  assert.equal(nodes['#radio'].src, source);
  notify(result([row(1)], { partial: true })); await tick();
  nodes['#retry-scan'].click(); await tick();
  const old = delayed.shift();
  notify(result([row(2)], { partial: true })); await tick();
  reply(old, result([row(99)], { kind: 'retry' })); await tick();
  assert.deepEqual(nodes['#stations'].children.map(item => item.children[0].children[0].children[0].textContent), ['Station 2']);
  notify(result([row(3, 'GB')], { countryCode: 'GB' })); await tick();
  assert.equal(nodes['#stations'].children.length, 1);
  notify({ kind: 'initial', status: 'ok', countryCode: 'GB', stations: [] }); await tick();
  assert.match(nodes['#summary'].textContent, /Could not load/);
  nodes['#stations'].children[0].children[0].click();
  const callsBeforeNts = sent.filter(item => item.method === 'tools/call').length;
  nodes['#nts-tab'].click();
  assert.equal(nodes['#nts-panel'].hidden, false);
  assert.equal(nodes['#country-attribution'].hidden, false, 'country selection keeps its disclosure while browsing NTS');
  ntsButtons[0].click(); await tick();
  assert.equal(nodes['#toggle'].disabled, true);
  assert.match(nodes['#status'].textContent, /In-player listening is unavailable/);
  assert.equal(nodes['#station-title'].textContent, 'NTS 1');
  assert.equal(nodes['#country-attribution'].hidden, true);
  assert.equal(sent.filter(item => item.method === 'tools/call').length, callsBeforeNts, 'NTS does not report a Radio Browser click');
  nodes['#countries-tab'].click();
  notify(result([row(3, 'GB')], { countryCode: 'GB', partial: true })); await tick();
  nodes['#retry-scan'].click(); await tick();
  const canceledRetry = delayed.shift();
  assert.equal(nodes['#retry-scan'].disabled, true);
  nodes['#country-select'].value = 'US';
  nodes['#country-select'].dispatchEvent(new Event('change'));
  await tick();
  const failedPicker = delayedFind.shift();
  assert.equal(nodes['#retry-scan'].disabled, true, 'Retry waits while picker request is active');
  replyError(failedPicker); await tick();
  assert.equal(nodes['#country-select'].value, 'GB', 'failed picker restores retained catalog country');
  assert.equal(nodes['#retry-scan'].hidden, false);
  assert.equal(nodes['#retry-scan'].disabled, false, 'canceled retry no longer leaves control disabled');
  reply(canceledRetry, result([row(99, 'GB')], { kind: 'retry', countryCode: 'GB' })); await tick();
  assert.equal(nodes['#retry-scan'].disabled, false);
  assert.equal(nodes['#stations'].children[0].children[0].children[0].children[0].textContent, 'Station 3');
  nodes['#country-select'].value = 'US';
  nodes['#country-select'].dispatchEvent(new Event('change'));
  await tick();
  const successfulPicker = delayedFind.shift();
  const pickerResult = { ...result([row(50, 'US')], { countryCode: 'US' }), requestId: successfulPicker.params.arguments.requestId };
  reply(successfulPicker, pickerResult); await tick();
  assert.equal(nodes['#stations'].children.length, 1);
  assert.equal(nodes['#stations'].children[0].children[0].children[0].children[0].textContent, 'Station 50');
  assert.equal(nodes['#country-select'].value, 'US');
  nodes['#stations'].children[0].children[0].click();
  nodes['#toggle'].click(); await tick();
  const currentSource = nodes['#radio'].src;
  assert.equal(nodes['#status'].dataset.state, 'playing');
  notify({ ...result([row(51, 'US')], { countryCode: 'US' }), requestId: failedPicker.params.arguments.requestId });
  notify(pickerResult); await tick();
  assert.equal(nodes['#radio'].src, currentSource, 'late old and duplicate same-country notifications do not replace playing source');
  assert.equal(nodes['#status'].dataset.state, 'playing');
  notify(result([row(52, 'US')], { countryCode: 'US' })); await tick();
  assert.equal(nodes['#stations'].children[0].children[0].children[0].children[0].textContent, 'Station 52', 'fresh chat-originated same-country result still applies');
  nodes['#country-select'].value = 'GB';
  nodes['#country-select'].dispatchEvent(new Event('change'));
  await tick();
  const supersededPicker = delayedFind.shift();
  notify(result([row(53, 'FR')], { countryCode: 'FR' })); await tick();
  reply(supersededPicker, { ...result([row(54, 'GB')], { countryCode: 'GB' }), requestId: supersededPicker.params.arguments.requestId }); await tick();
  assert.equal(nodes['#country-select'].value, 'FR', 'fresh chat request wins over an in-flight picker');
  assert.equal(nodes['#stations'].children[0].children[0].children[0].children[0].textContent, 'Station 53');
}
