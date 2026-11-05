import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStations } from '../dist/station-list.js';

class Element extends EventTarget {
  children = [];
  textContent = '';
  disabled = false;
  attributes = {};
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  click() { this.dispatchEvent(new Event('click')); }
}
const originalDocument = globalThis.document;
globalThis.document = { createElement: () => new Element() };
test.after(() => { globalThis.document = originalDocument; });
function setup() { return { list: new Element(), summary: new Element(), toggle: new Element() }; }
const station = { id: 'id', name: '<img src=x onerror=alert(1)>', countryCode: 'FR', streamUrl: 'https://audio.bfmtv.com/radio.mp3', origin: 'https://audio.bfmtv.com', codec: 'MP3', bitrate: 128, clickToken: 'token' };

test('safe text rendering, bounded choices, keyboard button selection', () => {
  const ui = setup();
  const selected = [];
  renderStations({ status: 'ok', countryCode: 'FR', stations: [station, ...Array.from({ length: 20 }, (_, i) => ({ ...station, id: String(i) }))] }, ui.list, ui.summary, ui.toggle, row => selected.push(row));
  assert.equal(ui.list.children.length, 10);
  assert.equal(ui.list.children[0].children[0].textContent, `Select ${station.name}`);
  assert.equal(ui.list.children[0].children[1].textContent, 'FR · MP3 · 128 kbps');
  ui.list.children[0].children[0].click();
  assert.deepEqual(selected, [station]);
  assert.equal(ui.toggle.disabled, false);
});

test('unsafe URL is never selectable and statuses replace stale rows', () => {
  const ui = setup();
  const selected = [];
  renderStations({ status: 'ok', countryCode: 'FR', stations: [{ ...station, streamUrl: 'https://evil.test/play' }, { ...station, streamUrl: 'https://audio.bfmtv.com:444/play' }] }, ui.list, ui.summary, ui.toggle, row => selected.push(row));
  assert.equal(ui.list.children.length, 0);
  for (const status of ['invalid_country', 'no_stations', 'no_supported_stations', 'provider_unavailable']) {
    renderStations({ status, countryCode: 'FR', stations: [] }, ui.list, ui.summary, ui.toggle, row => selected.push(row));
    assert.equal(ui.list.children.length, 0);
    assert.equal(ui.toggle.disabled, true);
    assert.ok(ui.summary.textContent.length > 0);
  }
  assert.deepEqual(selected, []);
});
