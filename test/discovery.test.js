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

test('uppercase provider UUID is canonical in the row and usable click token', async () => {
  const uppercase = 'ABCDEFAB-1234-4000-8000-ABCDEFABCDEF';
  const result = await discover('FR', { fetcher: async () => json([row(1, { stationuuid: uppercase })]) });
  assert.equal(result.status, 'ok');
  assert.equal(result.stations[0].id, uppercase.toLowerCase());
  assert.equal(tokenStationId(result.stations[0].clickToken), uppercase.toLowerCase());
});

test('discovery and click requests reject redirects at the fetch boundary', async () => {
  const result = await discover('FR', { fetcher: async (_url, init) => {
    assert.equal(init.redirect, 'error');
    throw new TypeError('redirect blocked');
  } });
  assert.equal(result.status, 'provider_unavailable');
  const token = (await discover('FR', { fetcher: async () => json([row(1)]) })).stations[0].clickToken;
  assert.equal(await reportClick(token, { fetcher: async (_url, init) => {
    assert.equal(init.redirect, 'error');
    throw new TypeError('redirect blocked');
  } }), false);
});

test('HTTP and declared-oversize early exits abort and cancel response bodies', async () => {
  for (const { status, headers } of [{ status: 503, headers: {} }, { status: 200, headers: { 'content-length': '512001' } }]) {
    let signal;
    let cancellations = 0;
    const result = await discover('FR', { fetcher: async (_url, init) => {
      signal = init.signal;
      return new Response(new ReadableStream({ cancel() { cancellations++; } }), { status, headers });
    } });
    assert.equal(result.status, 'provider_unavailable');
    assert.equal(signal.aborted, true);
    assert.equal(cancellations, 1);
  }
});

test('slow provider fetch and slow body terminate at the discovery timeout', async () => {
  const timeoutMs = 20;
  const slowFetch = await discover('FR', { timeoutMs, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  assert.equal(slowFetch.status, 'provider_unavailable');
  let bodyAborted = false;
  const slowBody = await discover('FR', { timeoutMs, fetcher: async (_url, init) => {
    const body = new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => { bodyAborted = true; controller.error(new Error('aborted')); }, { once: true });
    } });
    return new Response(body);
  } });
  assert.equal(slowBody.status, 'provider_unavailable');
  assert.equal(bodyAborted, true);
});

test('bounded continuation uses exact offsets and rejects arbitrary pages', async () => {
  const offsets = [];
  for (const pageIndex of [0, 1, 2]) {
    const result = await discover('FR', { pageIndex, fetcher: async url => { offsets.push(new URL(url).searchParams.get('offset')); return json([row(pageIndex + 1)]); } });
    assert.equal(result.kind, pageIndex ? 'continuation' : 'initial');
    assert.equal(result.pageIndex, pageIndex);
    assert.equal(result.stations.length, 1);
  }
  assert.deepEqual(offsets, ['0', '50', '100']);
  for (const pageIndex of [-1, 3, 1.5, Infinity]) await assert.rejects(discover('FR', { pageIndex }), RangeError);
  for (const country of ['FR', 'GB', 'US', 'CA', 'DE', 'JP', 'ES', 'IT']) {
    assert.equal((await discover(country, { fetcher: async () => json([]) })).countryCode, country);
  }
});

test('exact approved origins, duplicate URLs and exact UUID overrides only', async () => {
  const meuh = '960a0f41-0601-11e8-ae97-52543be04c81';
  const rows = [
    row(1, { url_resolved: 'https://streamer.radio.co/s66f2626b4/listen' }),
    row(2, { url_resolved: 'https://streamer.radio.co/s66f2626b4/listen' }),
    row(3, { url_resolved: 'https://icy.unitedradio.it/um020.mp3' }),
    row(4, { stationuuid: meuh, url_resolved: 'http://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3' }),
    row(5, { url_resolved: 'http://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3' }),
    row(6, { url_resolved: 'https://ice5.somafm.com/secretagent-128-mp3' })
  ];
  const result = await discover('FR', { fetcher: async () => json(rows) });
  assert.deepEqual(result.stations.map(s => s.id), [id(1), id(3), meuh]);
  assert.equal(result.stations[2].streamUrl, 'https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3');
  assert.equal(tokenStationId(result.stations[2].clickToken), meuh);
  assert.ok(!MEDIA_ORIGINS.includes('https://ice5.somafm.com'));
});

test('US and ES catalog rows use their approved direct URLs and retain provider click UUIDs', async () => {
  const candidates = [
    { country: 'US', uuid: '9627dcf4-0601-11e8-ae97-52543be04c81', url: 'https://listen.181fm.com/181-beat_128k.mp3' },
    { country: 'ES', uuid: '3fd18c3f-8157-11e9-aa30-52543be04c81', url: 'https://streams.radio.co/se1a320b47/listen' }
  ];
  for (const { country, uuid, url } of candidates) {
    const providerRow = row(1, { stationuuid: uuid, countrycode: country, url_resolved: url });
    const result = await discover(country, { fetcher: async () => json([providerRow]) });
    assert.equal(result.status, 'ok');
    assert.equal(result.stations[0].streamUrl, url);
    assert.equal(result.stations[0].origin, new URL(url).origin);
    assert.equal(tokenStationId(result.stations[0].clickToken), uuid);
    const changedProviderUrl = { ...providerRow, url_resolved: `https://unlisted.example/${country}.mp3` };
    assert.equal((await discover(country, { fetcher: async () => json([changedProviderUrl]) })).status, 'no_supported_stations', 'new UUIDs have no URL override');
    for (const change of [
      { countrycode: country === 'US' ? 'ES' : 'US' },
      { codec: 'AAC' },
      { stationuuid: 'invalid' },
      { url_resolved: url.replace('https:', 'http:') },
      { url_resolved: url.replace(new URL(url).host, 'unlisted.example') },
      { url_resolved: url.replace(new URL(url).host, `${new URL(url).host}:443`) },
      { url_resolved: url.replace(new URL(url).host, `${new URL(url).host}:8443`) },
      { url_resolved: url.replace('https://', 'https:\\') },
      { url_resolved: url.replace('https://', 'https://user@') },
      { url_resolved: `${url}#fragment` },
      { url_resolved: `${new URL(url).origin}/playlist.m3u` }
    ]) {
      assert.equal((await discover(country, { fetcher: async () => json([{ ...providerRow, ...change }]) })).status, 'no_supported_stations');
    }
  }
});
