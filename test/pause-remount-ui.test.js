import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const script = readFileSync('dist/player.js', 'utf8');
const tick = async () => { await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r)); };
class Element extends EventTarget {
  children = []; dataset = {}; attributes = {}; textContent = ''; hidden = false; disabled = false; src = ''; value = ''; error = null; paused = true;
  append(...items) { this.children.push(...items); } replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = value; } querySelectorAll(selector) { return selector === '.nts-option' ? this.children : []; }
  querySelector() { return null; } removeAttribute() { this.src = ''; } load() {} pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  play() { this.paused = false; return Promise.resolve(); } click() { this.dispatchEvent(new Event('click')); }
}
function mount(storage, messages) {
  const nodes = Object.fromEntries(['#radio','#toggle','#status','#stations','#summary','#more-stations','#retry-scan','#remote-pause','#remote-status','#station-title','#station-subtitle','#country-select','#countries-tab','#nts-tab','#countries-panel','#nts-panel','#country-attribution','#archive-query','#archive-search-button','#archive-results','#archive-status','#archive-link','#pause-panel','#player-section','#pause-status','#pause-retry','#archive-seek','#archive-time'].map(key => [key, new Element()]));
  const listeners = new Map(); const channels = [];
  const window = { innerWidth: 480, addEventListener(name, handler) { listeners.set(name, handler); }, removeEventListener() {}, parent: { postMessage(message) { if (message.method === 'ui/initialize') queueMicrotask(() => listeners.get('message')?.({ data: { jsonrpc:'2.0', id: message.id, result: { protocolVersion:'2026-01-26', hostInfo:{name:'fixture',version:'1'}, hostCapabilities:{}, hostContext:{} } }, source: window.parent })); } } };
  const document = { querySelector: key => nodes[key] ?? null, createElement: () => new Element(), documentElement: { style: {}, getBoundingClientRect: () => ({ height: 400 }) }, body: new Element() };
  class BroadcastChannel { onmessage = null; constructor() { channels.push(this); } postMessage(message) { messages.push(message); } close() {} }
  class ResizeObserver { observe() {} disconnect() {} }
  const navigator = { locks: { request() { throw new Error('not called'); } } };
  runInNewContext(script, { window, document, navigator, sessionStorage: storage, BroadcastChannel, ResizeObserver, URL, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {}, queueMicrotask, requestAnimationFrame: cb => queueMicrotask(cb), Event, EventTarget, AbortController, TextEncoder, TextDecoder, console: { ...console, debug() {} } }, { timeout: 5000 });
  const notify = structuredContent => listeners.get('message')?.({ data: { jsonrpc:'2.0', method:'ui/notifications/tool-result', params: { content: [], structuredContent } }, source: window.parent });
  const announceOwner = epoch => channels[0].onmessage?.({ data: { v:1, type:'status', sender:'new-owner', epoch, station:'New stream', active:true } });
  return { notify, announceOwner, nodes };
}
test('remounted old pause card does not send Pause to a newly active stream', async () => {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const messages = [];
  const first = mount(storage, messages); await tick(); first.announceOwner('old-epoch'); first.notify({ launchMode:'pause-control', requestId:'pause-once-1', issuedAt: Date.now() }); await tick();
  assert.equal(messages.filter(message => message.type === 'pause').length, 1);
  const second = mount(storage, messages); await tick(); second.announceOwner('new-epoch'); second.notify({ launchMode:'pause-control', requestId:'pause-once-1', issuedAt: Date.now() }); await tick();
  assert.equal(messages.filter(message => message.type === 'pause').length, 1, 'old card remount issues no pause toward the new owner');
  assert.match(second.nodes['#pause-status'].textContent, /already attempted/);
  storage.setItem('dial-pause-requests-v1', JSON.stringify(Array.from({ length: 32 }, (_, index) => `later-${index}`)));
  const third = mount(storage, messages); await tick(); third.announceOwner('still-newer');
  third.notify({ launchMode:'pause-control', requestId:'pause-once-1', issuedAt:Date.now() - 60_000 }); await tick();
  assert.equal(messages.filter(message => message.type === 'pause').length, 1, 'an old card remains inert after its bounded marker is evicted');
  assert.match(third.nodes['#pause-status'].textContent, /no longer fresh/);
});
