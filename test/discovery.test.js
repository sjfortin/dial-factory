import test from 'node:test';
import assert from 'node:assert/strict';
import { discover, MEDIA_ORIGINS, reportClick, tokenStationId } from '../dist/discovery.js';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (n, overrides = {}) => ({ stationuuid: id(n), name: `Station ${n}`, countrycode: 'FR', codec: 'MP3', bitrate: 128, url_resolved: `https://audio.bfmtv.com/${n}.mp3`, ...overrides });
const json = (rows) => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });

test('country validation is checked in and rejects bad or unassigned codes without a request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return json([]); };
  for (const code of [undefined, '', 'ZZ', 'AA', 'FRA', '1R']) {
    const result = await discover(code, { fetcher });
    assert.equal(result.status, 'invalid_country');
  }
  assert.equal(calls, 0);
  const result = await discover(' fr ', { fetcher });
  assert.equal(result.countryCode, 'FR');
  assert.equal(result.status, 'no_stations');
  assert.equal(calls, 1);
});

test('bounded query and stable filtering: first 50 only, 10 maximum, exact origins, dedupe', async () => {
  let requested;
  const rows = [row(1, { name: ' <img onerror=alert(1)> ', bitrate: 9999 }), row(1), row(2, { countrycode: 'GB' }), row(3, { url_resolved: 'http://audio.bfmtv.com/3.mp3' }), row(4, { url_resolved: 'https://audio.bfmtv.com:444/4.mp3' }), row(5, { url_resolved: 'https://evil.test/5.mp3' }), row(6, { url_resolved: 'https://audio.bfmtv.com/6.m3u8' }), row(7, { codec: 'AAC' }), ...Array.from({ length: 50 }, (_, i) => row(i + 8))];
  const result = await discover('fr', { fetcher: async (url, init) => { requested = { url, init }; return json(rows); } });
  assert.equal(result.status, 'ok');
  assert.equal(result.searchedCount, 50);
  assert.equal(result.stations.length, 10);
  assert.deepEqual(result.stations.map(s => s.id), [id(1), ...Array.from({ length: 9 }, (_, i) => id(i + 8))]);
  assert.equal(result.stations[0].name, '<img onerror=alert(1)>');
  assert.equal(result.stations[0].bitrate, undefined);
  assert.equal(result.stations[0].origin, MEDIA_ORIGINS[1]);
  const url = new URL(requested.url);
  assert.equal(url.pathname, '/json/stations/bycountrycodeexact/FR');
  assert.equal(url.searchParams.get('order'), 'votes');
  assert.equal(url.searchParams.get('reverse'), 'true');
  assert.equal(url.searchParams.get('offset'), '0');
  assert.equal(url.searchParams.get('limit'), '50');
  assert.equal(url.searchParams.get('hidebroken'), 'true');
  assert.match(requested.init.headers['user-agent'], /DialRadioProof/);
});

test('empty, unsupported, provider HTTP, malformed, oversized and bad endpoint remain distinct', async () => {
  assert.equal((await discover('FR', { fetcher: async () => json([]) })).status, 'no_stations');
  assert.equal((await discover('FR', { fetcher: async () => json([row(1, { codec: 'AAC' })]) })).status, 'no_supported_stations');
  for (const fetcher of [async () => new Response('oops', { status: 503 }), async () => new Response('{}'), async () => new Response('x'.repeat(512_001))]) {
    assert.equal((await discover('FR', { fetcher })).status, 'provider_unavailable');
  }
  assert.equal((await discover('FR', { providerOrigin: 'http://bad.test', fetcher: async () => json([]) })).status, 'provider_unavailable');
});

test('click token is signed, expires, and only forwards derived UUID', async () => {
  const now = Date.now();
  const result = await discover('FR', { fetcher: async () => json([row(1)]), now });
  const token = result.stations[0].clickToken;
  assert.equal(tokenStationId(token, now), id(1));
  assert.equal(tokenStationId(token, now + 10 * 60_000), null);
  assert.equal(tokenStationId(token.replace('00000000', '11111111')), null);
  let requested;
  assert.equal(await reportClick(token, { fetcher: async (url) => { requested = url; return new Response('{}'); } }), true);
  assert.equal(new URL(requested).pathname, `/json/url/${id(1)}`);
  assert.equal(await reportClick('not-a-token', { fetcher: async () => { throw new Error('must not call'); } }), false);
  assert.equal(await reportClick(token, { fetcher: async () => new Response('failure', { status: 500 }) }), false);
});
