import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationCatalog, renderStations } from '../dist/station-list.js';

class Element extends EventTarget {
  children = [];
  textContent = '';
  disabled = false;
  attributes = {};
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelectorAll(selector) { return selector === 'button.station-option' ? this.children.map(item => item.children[0]) : []; }
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
  renderStations({ status: 'ok', countryCode: 'FR', stations: [station, ...Array.from({ length: 20 }, (_, i) => ({ ...station, id: String(i), streamUrl: `https://audio.bfmtv.com/${i}.mp3` }))] }, ui.list, ui.summary, ui.toggle, row => selected.push(row));
  assert.equal(ui.list.children.length, 10);
  assert.equal(ui.list.children[0].children[0].attributes['aria-label'], `Select ${station.name}`);
  assert.equal(ui.list.children[0].children[0].children[0].children[0].textContent, station.name);
  assert.equal(ui.list.children[0].children[0].children[0].children[1].textContent, 'FR · MP3 · 128 kbps');
  ui.list.children[0].children[0].click();
  assert.equal(ui.list.children[0].children[0].attributes['aria-pressed'], 'true');
  assert.equal(ui.list.children[1].children[0].attributes['aria-pressed'], 'false');
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

test('browser accepts only the new exact origins with safe source URLs', () => {
  const ui = setup(); const selected = [];
  renderStations({ status: 'ok', countryCode: 'FR', stations: [
    { ...station, id: 'us', streamUrl: 'https://listen.181fm.com/181-beat_128k.mp3', origin: 'https://listen.181fm.com' },
    { ...station, id: 'es', streamUrl: 'https://streams.radio.co/se1a320b47/listen', origin: 'https://streams.radio.co' },
    { ...station, id: 'other', streamUrl: 'https://other.radio.co/listen', origin: 'https://other.radio.co' },
    { ...station, id: 'port', streamUrl: 'https://streams.radio.co:8443/listen', origin: 'https://streams.radio.co' },
    { ...station, id: 'playlist', streamUrl: 'https://listen.181fm.com/playlist.m3u', origin: 'https://listen.181fm.com' }
  ] }, ui.list, ui.summary, ui.toggle, row => selected.push(row));
  assert.deepEqual(ui.list.children.map(item => item.children[0].attributes['aria-label']), [`Select ${station.name}`, `Select ${station.name}`]);
  ui.list.children[1].children[0].click();
  assert.equal(selected[0].id, 'es');
});

test('three bounded pages append unique rows while preserving selection and retrying a failed page', () => {
  const ui = setup(); const selected = [];
  const catalog = createStationCatalog(ui.list, ui.summary, ui.toggle, row => selected.push(row));
  const page = (pageIndex, stations, status = 'ok', searchedCount = 50) => ({ kind: pageIndex ? 'continuation' : 'initial', pageIndex, countryCode: 'FR', status, searchedCount, stations });
  const distinct = i => ({ ...station, id: `id-${i}`, streamUrl: `https://audio.bfmtv.com/${i}.mp3` });
  catalog.receive(page(0, [distinct(0), distinct(1)]));
  const generation = catalog.generation;
  ui.list.children[0].children[0].click();
  assert.equal(catalog.nextPage, 1);
  catalog.receive(page(1, [], 'provider_unavailable', 0), generation);
  assert.equal(catalog.nextPage, 1);
  assert.equal(ui.list.children.length, 2);
  assert.equal(ui.list.children[0].children[0].attributes['aria-pressed'], 'true');
  catalog.receive(page(1, [distinct(1), { ...distinct(2), streamUrl: distinct(0).streamUrl }, distinct(3)]), generation);
  assert.deepEqual(catalog.rows.map(row => row.id), ['id-0', 'id-1', 'id-3']);
  assert.equal(ui.list.children[0].children[0].attributes['aria-pressed'], 'true');
  assert.equal(catalog.nextPage, 2);
  catalog.receive(page(1, [distinct(4)]), generation);
  assert.equal(catalog.rows.length, 3);
  catalog.receive(page(2, [], 'no_stations', 0), generation);
  assert.equal(catalog.nextPage, null);
  assert.match(ui.summary.textContent, /none in requested window 101–150/);
  assert.deepEqual(selected.map(row => row.id), ['id-0']);
});

test('new same-country and return-to-country searches reject stale page and error', () => {
  const ui = setup();
  const catalog = createStationCatalog(ui.list, ui.summary, ui.toggle, () => {});
  const initial = (countryCode, id) => ({ kind: 'initial', pageIndex: 0, countryCode, status: 'ok', searchedCount: 50, stations: [{ ...station, id, countryCode, streamUrl: `https://audio.bfmtv.com/${id}.mp3` }] });
  const late = (status, id) => ({ kind: 'continuation', pageIndex: 1, countryCode: 'FR', status, searchedCount: status === 'ok' ? 50 : 0, stations: status === 'ok' ? [{ ...station, id, streamUrl: `https://audio.bfmtv.com/${id}.mp3` }] : [] });
  catalog.receive(initial('FR', 'old'));
  const oldGeneration = catalog.generation;
  catalog.receive(initial('FR', 'fresh'));
  assert.equal(catalog.receive(late('ok', 'stale'), oldGeneration), 'ignored');
  assert.equal(catalog.receive(late('provider_unavailable', 'stale'), oldGeneration), 'ignored');
  assert.deepEqual(catalog.rows.map(row => row.id), ['fresh']);
  catalog.receive(initial('GB', 'other'));
  catalog.receive(initial('FR', 'return'));
  assert.equal(catalog.receive(late('ok', 'stale'), oldGeneration), 'ignored');
  assert.deepEqual(catalog.rows.map(row => row.id), ['return']);
  assert.equal(catalog.nextPage, 1);
});

test('short initial page reports actual inspected range', () => {
  const ui = setup();
  const catalog = createStationCatalog(ui.list, ui.summary, ui.toggle, () => {});
  catalog.receive({ kind: 'initial', pageIndex: 0, countryCode: 'FR', status: 'ok', searchedCount: 1, stations: [station] });
  assert.match(ui.summary.textContent, /Inspected provider rows 1–1/);
  assert.equal(catalog.nextPage, null);
});
