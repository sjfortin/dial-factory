import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationCatalog } from '../dist/station-list.js';

class Element extends EventTarget {
  children = []; textContent = ''; disabled = false; attributes = {};
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  querySelectorAll(selector) { return selector === 'button.station-option' ? this.children.map(item => item.children[0]) : []; }
  click() { this.dispatchEvent(new Event('click')); }
}
const previous = globalThis.document;
globalThis.document = { createElement: () => new Element() };
test.after(() => { globalThis.document = previous; });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, countryCode = 'FR') => ({ id: id(n), name: `<unsafe ${n}>`, countryCode, streamUrl: `https://audio.bfmtv.com/${n}.mp3`, origin: 'https://audio.bfmtv.com', codec: 'MP3', bitrate: 128, clickToken: `token-${n}` });
const windows = (partial = false) => [0, 1, 2].map(pageIndex => ({ pageIndex, offset: pageIndex * 50, searchedCount: pageIndex === 0 ? 50 : 0, success: !(partial && pageIndex === 1) }));
const result = (stations, { kind = 'initial', countryCode = 'FR', partial = false, status = 'ok', choiceLimitReached = false } = {}) => ({ kind, countryCode, status, stations, windows: windows(partial), scanState: partial ? 'partial' : 'complete', choiceLimitReached });
function setup() { const list = new Element(), summary = new Element(), toggle = new Element(), selected = []; return { list, summary, toggle, selected, catalog: createStationCatalog(list, summary, toggle, row => selected.push(row)) }; }

test('US nine choices reveal 8+1 locally with no speculative More', () => {
  const ui = setup();
  assert.equal(ui.catalog.receive(result(Array.from({ length: 9 }, (_, i) => row(i + 1)))), 'initial');
  assert.equal(ui.list.children.length, 8);
  assert.equal(ui.catalog.canMore, true);
  ui.list.children[0].children[0].click();
  assert.equal(ui.list.children[0].children[0].children[0].children[0].textContent, '<unsafe 1>');
  assert.equal(ui.toggle.disabled, false);
  assert.equal(ui.catalog.reveal(), true);
  assert.equal(ui.list.children.length, 9);
  assert.equal(ui.catalog.canMore, false);
  assert.equal(ui.catalog.reveal(), false);
  assert.equal(ui.catalog.selectedId, id(1));
  assert.equal(ui.list.children[0].children[0].attributes['aria-pressed'], 'true');
  assert.deepEqual(ui.selected.map(s => s.id), [id(1)]);
});

test('France six and Japan one show no More; duplicate-only retries add nothing', () => {
  const ui = setup();
  ui.catalog.receive(result(Array.from({ length: 6 }, (_, i) => row(i + 1)), { partial: true }));
  assert.equal(ui.catalog.canMore, false);
  assert.equal(ui.catalog.canRetry, true);
  const generation = ui.catalog.generation;
  ui.catalog.receive(result([row(1), { ...row(7), streamUrl: row(2).streamUrl }], { kind: 'retry' }), generation);
  assert.equal(ui.catalog.rows.length, 6);
  assert.equal(ui.catalog.canRetry, false);
  ui.catalog.receive(result([row(1, 'JP')], { countryCode: 'JP' }));
  assert.equal(ui.catalog.canMore, false);
  assert.equal(ui.list.children.length, 1);
});

test('partial retry appends unique valid choices and preserves visible selection', () => {
  const ui = setup();
  ui.catalog.receive(result(Array.from({ length: 9 }, (_, i) => row(i + 1)), { partial: true }));
  ui.list.children[0].children[0].click();
  const generation = ui.catalog.generation;
  const accepted = ui.catalog.receive(result([row(1), { ...row(10), streamUrl: row(2).streamUrl }, row(11), { ...row(12), streamUrl: 'https://evil.test/x' }], { kind: 'retry', partial: true }), generation);
  assert.equal(accepted, 'retry');
  assert.equal(ui.catalog.rows.length, 10);
  assert.equal(ui.list.children.length, 8);
  assert.equal(ui.catalog.canMore, true);
  assert.equal(ui.catalog.canRetry, true);
  assert.equal(ui.catalog.selectedId, id(1));
  ui.catalog.reveal();
  assert.equal(ui.list.children.length, 10);
  assert.equal(ui.list.children[0].children[0].attributes['aria-pressed'], 'true');
});

test('same-country and cross-country stale retry cannot mutate new initial results', () => {
  const ui = setup();
  ui.catalog.receive(result([row(1)], { partial: true }));
  const oldGeneration = ui.catalog.generation;
  ui.catalog.receive(result([row(2)], { partial: true }));
  assert.equal(ui.catalog.receive(result([row(3)], { kind: 'retry' }), oldGeneration), 'ignored');
  ui.catalog.receive(result([row(4, 'GB')], { countryCode: 'GB', partial: true }));
  assert.equal(ui.catalog.receive(result([row(5)], { kind: 'retry' }), ui.catalog.generation), 'ignored');
  assert.deepEqual(ui.catalog.rows.map(s => s.id), [id(4)]);
});

test('invalid result is ignored and load error does not erase prior choices', () => {
  const ui = setup();
  ui.catalog.receive(result([row(1)], { partial: true }));
  assert.equal(ui.catalog.receive({ kind: 'initial', countryCode: 'FR', status: 'ok', stations: [] }), 'ignored');
  ui.catalog.error('Retry failed.');
  assert.equal(ui.catalog.rows.length, 1);
  assert.equal(ui.summary.textContent, 'Retry failed.');
  assert.equal(ui.catalog.canRetry, true);
});

test('partial scan discloses both incompleteness and the 30-choice limit', () => {
  const ui = setup();
  ui.catalog.receive(result(Array.from({ length: 30 }, (_, i) => row(i + 1)), { partial: true, choiceLimitReached: true }));
  assert.match(ui.summary.textContent, /Latest scan incomplete/);
  assert.match(ui.summary.textContent, /30-choice catalog limit reached/);
  assert.equal(ui.catalog.canRetry, true);
  assert.equal(ui.catalog.canMore, true);
});

test('retry merge discloses the client cap even when neither scan individually reached it', () => {
  const ui = setup();
  ui.catalog.receive(result(Array.from({ length: 20 }, (_, i) => row(i + 1)), { partial: true }));
  const generation = ui.catalog.generation;
  ui.catalog.receive(result(Array.from({ length: 20 }, (_, i) => row(i + 21)), { kind: 'retry' }), generation);
  assert.equal(ui.catalog.rows.length, 30);
  assert.match(ui.summary.textContent, /30 retained compatible catalog choices/);
  assert.match(ui.summary.textContent, /30-choice catalog limit reached/);
  assert.equal(ui.catalog.canRetry, false);
});

test('empty successful retry describes latest scan separately from retained choices', () => {
  const ui = setup();
  ui.catalog.receive(result([row(1)], { partial: true }));
  ui.list.children[0].children[0].click();
  const generation = ui.catalog.generation;
  ui.catalog.receive(result([], { kind: 'retry', status: 'no_supported_stations' }), generation);
  assert.equal(ui.catalog.rows.length, 1);
  assert.equal(ui.catalog.selectedId, id(1));
  assert.match(ui.summary.textContent, /1 retained compatible catalog choices/);
  assert.match(ui.summary.textContent, /latest scan inspected 50 provider rows/);
  assert.match(ui.summary.textContent, /Latest scan: no compatible choices in these windows/);
  assert.equal(ui.catalog.canRetry, false);
});
