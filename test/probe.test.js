import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';

const tick = () => new Promise(resolve => setImmediate(resolve));
class Node extends EventTarget {
  textContent = ''; value = ''; paused = true; playCalls = 0; pauseCalls = 0;
  click() { this.dispatchEvent(new Event('click')); }
  play() { this.playCalls++; this.paused = false; return Promise.resolve(); }
  pause() { this.pauseCalls++; this.paused = true; }
  select() {}
}
class SharedLocks {
  held = false; waiting = [];
  async request(_name, options, callback) {
    if (options.ifAvailable) return callback(this.held ? null : {});
    if (this.held) await new Promise((resolve, reject) => {
      const item = { resolve, reject };
      this.waiting.push(item);
      options.signal?.addEventListener('abort', () => {
        this.waiting = this.waiting.filter(x => x !== item);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    this.held = true;
    try { return await callback({}); }
    finally { this.held = false; this.waiting.shift()?.resolve(); }
  }
}
function createFrames(script) {
  const locks = new SharedLocks();
  const channels = new Set();
  class Channel {
    constructor() { channels.add(this); }
    postMessage(data) { for (const other of channels) if (other !== this) queueMicrotask(() => other.onmessage?.({ data })); }
    close() { channels.delete(this); }
  }
  function frame() {
    const nodes = Object.fromEntries(['identity', 'state', 'nonce', 'hold', 'contend', 'transfer', 'release', 'heard', 'silent', 'copy', 'radio', 'results', 'checks'].map(key => [key, new Node()]));
    const listeners = new Map();
    const window = {
      innerWidth: 480,
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name) { listeners.delete(name); },
      parent: { postMessage(message) {
        if (message.method === 'ui/initialize') queueMicrotask(() => listeners.get('message')?.({ data: { jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'test-host', version: '1' }, hostCapabilities: {}, hostContext: {} } }, source: window.parent }));
      } }
    };
    const document = {
      visibilityState: 'visible', getElementById(key) { return nodes[key]; },
      addEventListener(name, callback) { listeners.set(`document:${name}`, callback); },
      documentElement: { style: { height: '' }, getBoundingClientRect() { return { height: 400 }; } },
      body: new Node()
    };
    class ResizeObserver { observe() {} disconnect() {} }
    runInNewContext(script, { window, document, navigator: { userAgent: 'local-harness', locks, clipboard: { writeText: async () => {} } }, location: { origin: 'https://example.test', href: 'https://example.test/probe' }, crypto: { randomUUID }, BroadcastChannel: Channel, console: { ...console, debug() {} }, URL, setTimeout, clearTimeout, queueMicrotask, requestAnimationFrame: callback => queueMicrotask(callback), ResizeObserver, Event, EventTarget, AbortController, TextEncoder, TextDecoder, performance, DOMException }, { timeout: 5000 });
    return { nodes, events: () => JSON.parse(nodes.results.value).events, close: () => listeners.get('pagehide')?.() };
  }
  return { a: frame(), b: frame(), locks };
}
test('delivered probe exchanges nonce and enforces shared lock before post-await play', async () => {
  const { a, b, locks } = createFrames(readFileSync('dist/probe.js', 'utf8'));
  await tick();
  a.nodes.nonce.click(); b.nodes.nonce.click();
  await tick();
  assert.ok(a.events().some(e => e.kind === 'nonce-roundtrip-pass'));
  assert.ok(b.events().some(e => e.kind === 'nonce-roundtrip-pass'));
  a.nodes.hold.click(); await tick();
  assert.equal(locks.held, true);
  b.nodes.contend.click(); await tick();
  assert.ok(b.events().some(e => e.kind === 'contention-check' && e.acquired === false));
  b.nodes.transfer.click(); await tick(); await tick();
  assert.ok(a.events().some(e => e.kind === 'stopped-and-released' && String(e.reason).includes('transfer')));
  assert.ok(b.events().some(e => e.kind === 'post-await-play-resolved'));
  assert.equal(b.nodes.radio.playCalls, 1);
  b.nodes.heard.click();
  assert.ok(b.events().some(e => e.kind === 'audible-observation' && e.heard === true));
  assert.match(b.nodes.checks.textContent, /Post-await play\(\): OBSERVED/);
  b.nodes.release.click(); await tick();
  assert.equal(locks.held, false);
  a.nodes.contend.click(); await tick();
  assert.ok(a.events().some(e => e.kind === 'contention-check' && e.acquired === true));
  a.close(); b.close();
});

test('holder teardown releases the simulated shared lock and permits recovery', async () => {
  const { a, b, locks } = createFrames(readFileSync('dist/probe.js', 'utf8'));
  a.nodes.hold.click(); await tick();
  assert.equal(locks.held, true);
  a.close(); await tick();
  assert.equal(locks.held, false);
  b.nodes.contend.click(); await tick();
  assert.ok(b.events().some(e => e.kind === 'contention-check' && e.acquired === true));
  b.close();
});
