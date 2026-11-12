import test from 'node:test';
import assert from 'node:assert/strict';
import { discover, MEDIA_ORIGINS, reportClick, tokenStationId } from '../dist/discovery.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, changes = {}) => ({ stationuuid: id(n), name: `Station ${n}`, countrycode: 'FR', codec: 'MP3', bitrate: 128, url_resolved: `https://audio.bfmtv.com/${n}.mp3`, ...changes });
const json = rows => new Response(JSON.stringify(rows));
const fixture = pages => async url => json(pages[Number(new URL(url).searchParams.get('offset')) / 50] ?? []);

test('invalid country uses zero requests; bounded scan always checks offsets 0, 50, 100', async () => {
  const offsets = [];
  const fetcher = async url => { offsets.push(Number(new URL(url).searchParams.get('offset'))); return json([]); };
  for (const code of [undefined, '', 'ZZ', 'AA', 'FRA']) assert.equal((await discover(code, { fetcher })).status, 'invalid_country');
  assert.deepEqual(offsets, []);
  const result = await discover(' fr ', { fetcher });
  assert.deepEqual(offsets, [0, 50, 100]);
  assert.equal(result.countryCode, 'FR');
  assert.equal(result.status, 'no_stations');
  assert.equal(result.scanState, 'complete');
  assert.deepEqual(result.windows.map(w => w.searchedCount), [0, 0, 0]);
});

test('short, empty and duplicate windows still reach later compatible choices', async () => {
  const result = await discover('FR', { fetcher: fixture([[row(1)], [], [row(1), row(2)]]) });
  assert.deepEqual(result.stations.map(s => s.id), [id(1), id(2)]);
  assert.deepEqual(result.windows.map(w => w.searchedCount), [1, 0, 2]);
  assert.equal(result.choiceLimitReached, false);
});

test('all 50 rows per window are filtered, with exact origin, codec, URL and UUID dedupe', async () => {
  const first = Array.from({ length: 49 }, (_, i) => row(i + 100, { codec: 'AAC' }));
  first.push(row(1, { name: ' <img> ', bitrate: 9999 }));
  const result = await discover('FR', { fetcher: fixture([first, [row(2, { url_resolved: 'https://audio.bfmtv.com/1.mp3' }), row(1), row(3), row(4, { url_resolved: 'https://evil.test/4.mp3' }), row(5, { url_resolved: 'https://audio.bfmtv.com:443/5.mp3' })], []]) });
  assert.deepEqual(result.stations.map(s => s.id), [id(1), id(3)]);
  assert.equal(result.stations[0].name, '<img>');
  assert.equal(result.stations[0].bitrate, undefined);
  assert.equal(result.stations[0].origin, MEDIA_ORIGINS[1]);
});

test('choice cap remains 30 and still inspects third window', async () => {
  const offsets = [];
  const result = await discover('FR', { fetcher: async url => { const page = Number(new URL(url).searchParams.get('offset')) / 50; offsets.push(page * 50); return json(Array.from({ length: 50 }, (_, i) => row(page * 50 + i + 1))); } });
  assert.deepEqual(offsets, [0, 50, 100]);
  assert.equal(result.stations.length, 30);
  assert.equal(result.choiceLimitReached, true);
  assert.deepEqual(result.windows.map(w => w.searchedCount), [50, 50, 50]);
});

test('partial scan keeps successful later choices and distinguishes failure from exhaustion', async () => {
  const fetcher = async url => { const offset = Number(new URL(url).searchParams.get('offset')); if (offset === 50) throw new Error('timeout'); return json(offset === 100 ? [row(2)] : []); };
  const result = await discover('FR', { fetcher });
  assert.equal(result.status, 'ok');
  assert.equal(result.scanState, 'partial');
  assert.deepEqual(result.windows.map(w => w.success), [true, false, true]);
  assert.deepEqual(result.stations.map(s => s.id), [id(2)]);
  const failure = await discover('FR', { fetcher: async () => new Response('{}') });
  assert.equal(failure.status, 'provider_unavailable');
  assert.equal(failure.scanState, 'partial');
  assert.equal((await discover('FR', { fetcher: fixture([[row(1, { codec: 'AAC' })], [], []]) })).status, 'no_supported_stations');
});

test('provider requests retain bounds, redirect rejection and response cap', async () => {
  const requests = [];
  await discover('FR', { fetcher: async (url, init) => { requests.push({ url: new URL(url), init }); return json([]); } });
  assert.equal(requests.length, 3);
  for (const [index, request] of requests.entries()) {
    assert.equal(request.url.origin, 'https://de1.api.radio-browser.info');
    assert.equal(request.url.pathname, '/json/stations/bycountrycodeexact/FR');
    assert.equal(request.url.searchParams.get('offset'), String(index * 50));
    assert.equal(request.url.searchParams.get('limit'), '50');
    assert.equal(request.url.searchParams.get('order'), 'votes');
    assert.equal(request.url.searchParams.get('hidebroken'), 'true');
    assert.equal(request.init.redirect, 'error');
  }
  for (const bad of [async () => new Response('oops', { status: 503 }), async () => new Response('x'.repeat(512_001)), async () => { throw new Error('redirect'); }]) {
    const result = await discover('FR', { fetcher: bad });
    assert.equal(result.status, 'provider_unavailable');
    assert.equal(result.windows.length, 3);
  }
});

test('retry kind, canonical UUID and signed click token remain intact', async () => {
  const now = Date.now();
  const upper = 'ABCDEFAB-1234-4000-8000-ABCDEFABCDEF';
  const result = await discover('FR', { kind: 'retry', now, fetcher: fixture([[row(1, { stationuuid: upper })], [], []]) });
  assert.equal(result.kind, 'retry');
  assert.equal(result.stations[0].id, upper.toLowerCase());
  const token = result.stations[0].clickToken;
  assert.equal(tokenStationId(token, now), upper.toLowerCase());
  assert.equal(tokenStationId(token, now + 10 * 60_000), null);
  let clickUrl;
  assert.equal(await reportClick(token, { fetcher: async url => { clickUrl = url; return new Response('{}'); } }), true);
  assert.equal(new URL(clickUrl).pathname, `/json/url/${upper.toLowerCase()}`);
});

test('exact UUID override remains finite and wrong codecs do not enter catalog', async () => {
  const override = '960a0f41-0601-11e8-ae97-52543be04c81';
  const result = await discover('FR', { fetcher: fixture([[row(1, { stationuuid: override, url_resolved: 'http://unapproved.test/stream' }), row(2, { codec: 'AAC' })], [], []]) });
  assert.equal(result.stations.length, 1);
  assert.equal(result.stations[0].id, override);
  assert.equal(result.stations[0].streamUrl, 'https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3');
  assert.equal(result.stations[0].origin, 'https://radiomeuh.ice.infomaniak.ch');
});

test('partial scan may reach the choice cap without claiming completeness', async () => {
  const result = await discover('FR', { fetcher: async url => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    if (offset === 50) throw new Error('provider failure');
    return json(Array.from({ length: offset ? 0 : 30 }, (_, i) => row(i + 1)));
  } });
  assert.equal(result.stations.length, 30);
  assert.equal(result.choiceLimitReached, true);
  assert.equal(result.scanState, 'partial');
  assert.deepEqual(result.windows.map(window => window.success), [true, false, true]);
});
