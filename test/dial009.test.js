import test from 'node:test';
import assert from 'node:assert/strict';
import { discover } from '../dist/discovery.js';
import { COUNTRY_CANDIDATES, MEDIA_ORIGINS, matchesCountryCandidate, parseMediaUrl } from '../dist/media-policy.js';
import { createStationCatalog } from '../dist/station-list.js';

const json = rows => new Response(JSON.stringify(rows));
const directoryRow = ([code, id, url], changes = {}) => ({ stationuuid: id, name: '<b>Provider text</b>', countrycode: code, codec: 'MP3', url_resolved: url, ...changes });
const pages = rows => async address => json(Number(new URL(address).searchParams.get('offset')) === 0 ? rows : []);

test('all 15 currently admitted exact candidate pairs require matching directory rows', async () => {
  assert.equal(COUNTRY_CANDIDATES.length, 15);
  assert.equal(new Set(COUNTRY_CANDIDATES.map(([code]) => code)).size, 15);
  for (const candidate of COUNTRY_CANDIDATES) {
    const [code, id, url] = candidate;
    const result = await discover(code, { fetcher: pages([directoryRow(candidate)]) });
    assert.equal(result.stations.length, 1, `${code} exact row`);
    assert.equal(result.stations[0].id, id);
    assert.equal(result.stations[0].streamUrl, url);
    assert.equal(result.stations[0].name, '<b>Provider text</b>');
    assert.equal(matchesCountryCandidate(id, code, url), true);
    assert.ok(MEDIA_ORIGINS.includes(new URL(url).origin));
    assert.equal((await discover(code, { fetcher: pages([]) })).stations.length, 0, `${code} missing row`);
  }
});

test('failed SE Bandit candidate and its origin are excluded while SE remains a valid country', async () => {
  const excluded = ['SE', '40dfa430-7988-4b02-ae1b-ce5fe8b5aad3', 'https://wr11-ice.stream.khz.se/wr11_mp3'];
  assert.equal(COUNTRY_CANDIDATES.some(([code]) => code === 'SE'), false);
  assert.equal(MEDIA_ORIGINS.includes('https://wr11-ice.stream.khz.se'), false);
  assert.equal(parseMediaUrl(excluded[2]), null);
  assert.equal(matchesCountryCandidate(...excluded), false);
  const result = await discover('SE', { fetcher: pages([directoryRow(excluded)]) });
  assert.equal(result.countryCode, 'SE');
  assert.equal(result.status, 'no_supported_stations');
  assert.equal(result.stations.length, 0);
  assert.equal(result.scanState, 'complete');
});

test('new origins reject nearby URLs, changed query, wrong country/codec and unsafe URL forms', async () => {
  const candidate = COUNTRY_CANDIDATES.find(([code]) => code === 'KR');
  const [code, id, url] = candidate;
  const alternatives = [
    { url_resolved: url.replace('mp=/s', 'mp=/other') },
    { url_resolved: url + '&x=1' },
    { url_resolved: url.replace('://', '://user@') },
    { url_resolved: url.replace('.com/', '.com:443/') },
    { url_resolved: 'https://antares.dribbcast.com/playlist.m3u' },
    { url_resolved: url + '#fragment' },
    { countrycode: 'JP' },
    { codec: 'AAC' },
    { stationuuid: '00000000-0000-4000-8000-000000000000' },
    { url_resolved: null, url }
  ];
  for (const changes of alternatives) {
    const result = await discover(code, { fetcher: pages([directoryRow(candidate, changes)]) });
    assert.equal(result.stations.length, 0, JSON.stringify(changes));
  }
  assert.equal(parseMediaUrl(url.replace('mp=/s', 'mp=/other')), null);
  assert.equal(matchesCountryCandidate(id, code, url + '&x=1'), false);
});

test('browser catalog rechecks candidate identity and renders names as text', () => {
  class Element extends EventTarget {
    children = []; textContent = ''; disabled = false; attributes = {};
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelectorAll() { return this.children.map(item => item.children[0]); }
  }
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new Element() };
  try {
    const list = new Element(), summary = new Element(), toggle = new Element();
    const catalog = createStationCatalog(list, summary, toggle, () => {});
    const [countryCode, id, streamUrl] = COUNTRY_CANDIDATES[0];
    const station = { id, name: '<script>alert(1)</script>', countryCode, streamUrl, origin: new URL(streamUrl).origin, codec: 'MP3', clickToken: 'signed-test-token' };
    const windows = [0, 1, 2].map(pageIndex => ({ pageIndex, offset: pageIndex * 50, searchedCount: 1, success: true }));
    catalog.receive({ kind: 'initial', status: 'ok', countryCode, stations: [
      { ...station, id: '00000000-0000-4000-8000-000000000000' },
      { ...station, streamUrl: streamUrl + '?extra=1' },
      station
    ], windows, scanState: 'complete', choiceLimitReached: false });
    assert.equal(catalog.rows.length, 1);
    assert.equal(list.children[0].children[0].children[0].children[0].textContent, station.name);
  } finally { globalThis.document = previous; }
});
