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
  const nodes = Object.fromEntries(['#radio', '#toggle', '#status', '#stations', '#summary', '#remote-pause', '#remote-status', '#station-title', '#station-subtitle'].map(id => [id, new Element()]));
  nodes['#toggle'].disabled = true;
  const listeners = new Map();
  const listenerOps = [];
  const sent = [];
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
        listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: 'Play count unavailable' }], structuredContent: { counted: false } } }, source: window.parent });
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
  const result = (status, stations) => listeners.get('message')?.({ data: { jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent: { status, countryCode: 'FR', searchedCount: stations.length, limit: 50, stations } } }, source: window.parent });
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
  result('provider_unavailable', []);
  await tick();
  assert.equal(nodes['#radio'].src, '');
  assert.equal(nodes['#status'].dataset.state, 'idle');
  assert.equal(nodes['#stations'].children.length, 0);
  assert.equal(nodes['#toggle'].disabled, true);
}
