import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';

class Element extends EventTarget {
  children = [];
  textContent = '';
  dataset = {};
  attributes = {};
  disabled = false;
  src = '';
  error = null;
  pauseCalls = 0;
  playCalls = 0;
  loadCalls = 0;
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelectorAll(selector) { return selector === 'button.station-option' ? this.children.map(item => item.children[0]) : []; }
  removeAttribute(key) { if (key === 'src') this.src = ''; }
  pause() { this.pauseCalls++; this.dispatchEvent(new Event('pause')); }
  load() { this.loadCalls++; this.error = null; }
  play() { this.playCalls++; return Promise.resolve(); }
  click() { this.dispatchEvent(new Event('click')); }
}
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); };

export async function exerciseDeliveredScript(script) {
  const nodes = Object.fromEntries(['#radio', '#toggle', '#status', '#stations', '#summary', '#more-stations', '#remote-pause', '#remote-status', '#station-title', '#station-subtitle'].map(id => [id, new Element()]));
  nodes['#toggle'].disabled = true;
  const listeners = new Map();
  const listenerOps = [];
  const sent = [];
  let deferMore = false;
  const delayed = [];
  const reply = (message, structuredContent) => listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'Tool response' }], structuredContent } }, source: window.parent });
  const window = {
    innerWidth: 480,
    addEventListener(name, callback) { listenerOps.push(`add:${name}`); listeners.set(name, callback); },
    removeEventListener(name, callback) { listenerOps.push(`remove:${name}`); if (listeners.get(name) === callback) listeners.delete(name); },
    parent: { postMessage(message) {
      sent.push(message);
      if (message.method === 'ui/initialize') queueMicrotask(() => {
        listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'test-host', version: '1' }, hostCapabilities: {}, hostContext: {} } }, source: window.parent });
      });
      if (message.method === 'tools/call') queueMicrotask(() => {
        const more = message.params?.name === 'more_stations_by_country';
        if (more && deferMore) { delayed.push(message); return; }
        const structuredContent = more ? { kind: 'continuation', pageIndex: message.params.arguments.pageIndex, countryCode: 'FR', status: 'ok', searchedCount: 50, limit: 50, stations: [{ id: 'c', name: 'C', countryCode: 'FR', streamUrl: 'https://icy.unitedradio.it/c.mp3', origin: 'https://icy.unitedradio.it', codec: 'MP3', clickToken: 'token-c' }] } : { counted: false };
        reply(message, structuredContent);
      });
    } }
  };
  const document = { querySelector(selector) { return nodes[selector] ?? null; }, createElement() { return new Element(); }, documentElement: { style: { height: '' }, getBoundingClientRect() { return { height: 400 }; } }, body: new Element() };
  class ResizeObserver { observe() {} disconnect() {} }
  class BroadcastChannel { onmessage = null; postMessage() {} close() {} }
  const navigator = { locks: { request(_name, { signal }, callback) {
    if (signal.aborted) return Promise.reject(new Error('aborted'));
    return Promise.resolve().then(callback);
  } } };
  runInNewContext(script, { window, document, navigator, BroadcastChannel, console: { ...console, debug() {} }, URL, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval: () => {}, queueMicrotask, requestAnimationFrame: (callback) => queueMicrotask(callback),
    ResizeObserver, Event, EventTarget, AbortController, TextEncoder, TextDecoder }, { timeout: 5000 });
  await tick();
  assert.ok(sent.some(item => item.method === 'ui/initialize'), 'delivered bundle initializes the MCP Apps bridge');
  assert.ok(sent.some(item => item.method === 'ui/notifications/initialized'), `bridge did not finish initialization: ${sent.map(item => item.method).join(', ')}`);
  const notify = structuredContent => listeners.get('message')?.({ data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent } }, source: window.parent });
  const result = (status, stations, countryCode = 'FR') => notify({ kind: 'initial', pageIndex: 0, status, countryCode, searchedCount: 50, limit: 50, stations });
  const row = (id, name, streamUrl, clickToken) => ({ id, name, countryCode: 'FR', streamUrl, origin: new URL(streamUrl).origin, codec: 'MP3', clickToken });
  const a = row('a', 'A <b>unsafe</b>', 'https://audio.bfmtv.com/a.mp3', 'token-a');
  const b = row('b', 'B', 'https://media-ssl.musicradio.com/b', 'token-b');
  result('ok', [a, b]);
  await tick();
  assert.equal(nodes['#stations'].children.length, 2, `tool result did not render; sent ${sent.map(item => item.method).join(', ')}; listener ${listeners.has('message')}; ops ${listenerOps.join(', ')}`);
  assert.equal(nodes['#stations'].children[0].children[0].children[0].children[0].textContent, 'A <b>unsafe</b>');
  assert.equal(nodes['#radio'].playCalls, 0, 'result does not autoplay');
  nodes['#stations'].children[0].children[0].click();
  assert.equal(nodes['#station-title'].textContent, 'A <b>unsafe</b>');
  assert.equal(nodes['#radio'].src, a.streamUrl);
  assert.equal(nodes['#status'].dataset.state, 'idle');
  nodes['#toggle'].click();
  await tick();
  assert.equal(nodes['#status'].dataset.state, 'playing');
  assert.ok(sent.some(item => item.method === 'tools/call' && item.params?.name === 'report_station_click' && item.params.arguments.clickToken === 'token-a'));
  nodes['#toggle'].click();
  assert.equal(nodes['#status'].dataset.state, 'paused');
  nodes['#stations'].children[1].children[0].click();
  assert.equal(nodes['#stations'].children[0].children[0].attributes['aria-pressed'], 'false');
  assert.equal(nodes['#stations'].children[1].children[0].attributes['aria-pressed'], 'true');
  assert.equal(nodes['#radio'].src, b.streamUrl);
  assert.equal(nodes['#status'].dataset.state, 'idle');
  nodes['#toggle'].click();
  await tick();
  assert.ok(sent.some(item => item.method === 'tools/call' && item.params?.name === 'report_station_click' && item.params.arguments.clickToken === 'token-b'));
  const playingSource = nodes['#radio'].src;
  const pausesBeforeMore = nodes['#radio'].pauseCalls;
  nodes['#more-stations'].click();
  await tick();
  assert.ok(sent.some(item => item.method === 'tools/call' && item.params?.name === 'more_stations_by_country' && item.params.arguments.pageIndex === 1));
  assert.equal(nodes['#stations'].children.length, 3);
  assert.equal(nodes['#radio'].src, playingSource);
  assert.equal(nodes['#radio'].pauseCalls, pausesBeforeMore);
  assert.equal(nodes['#status'].dataset.state, 'playing');
  assert.equal(nodes['#stations'].children[1].children[0].attributes['aria-pressed'], 'true');
  deferMore = true;
  result('ok', [a]);
  await tick();
  nodes['#more-stations'].click();
  await tick();
  const old = delayed.shift();
  assert.ok(old);
  result('ok', [b]); // fresh search for the same country
  await tick();
  nodes['#more-stations'].click();
  await tick();
  const current = delayed.shift();
  assert.ok(current);
  const oldPage = { kind: 'continuation', pageIndex: 1, countryCode: 'FR', status: 'ok', searchedCount: 50, limit: 50, stations: [row('stale', 'Stale', 'https://audio.bfmtv.com/stale.mp3', 'token-stale')] };
  notify(oldPage); // notification path has no generation and must be ignored
  reply(old, oldPage); // old request promise resolves after the reset
  await tick();
  assert.equal(nodes['#stations'].children.length, 1);
  assert.equal(nodes['#stations'].children[0].children[0].children[0].children[0].textContent, 'B');
  assert.equal(nodes['#more-stations'].disabled, true, 'old finally cannot release the current request');
  reply(current, { ...oldPage, stations: [row('fresh', 'Fresh', 'https://audio.bfmtv.com/fresh.mp3', 'token-fresh')] });
  await tick();
  assert.equal(nodes['#stations'].children.length, 2);
  result('ok', [a]);
  await tick();
  nodes['#more-stations'].click();
  await tick();
  const beforeSwitch = delayed.shift();
  result('ok', [{ ...b, countryCode: 'GB' }], 'GB');
  await tick();
  result('ok', [b]);
  await tick();
  reply(beforeSwitch, { ...oldPage, status: 'provider_unavailable', stations: [] });
  await tick();
  assert.equal(nodes['#stations'].children.length, 1);
  assert.doesNotMatch(nodes['#summary'].textContent, /Retry More stations/);
  assert.equal(nodes['#more-stations'].disabled, false);
  result('provider_unavailable', []);
  await tick();
  assert.equal(nodes['#radio'].src, '');
  assert.equal(nodes['#status'].dataset.state, 'idle');
  assert.equal(nodes['#stations'].children.length, 0);
  assert.equal(nodes['#toggle'].disabled, true);
}
