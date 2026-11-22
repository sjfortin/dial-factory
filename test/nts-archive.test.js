import test from 'node:test';
import assert from 'node:assert/strict';
import { searchArchive, showEpisodes, episodeDetail, resolveEpisode, validQuery, safeSoundCloud, validateMediaCandidate, validateManifest, ARCHIVE_ORIGIN } from '../dist/nts-archive.js';
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const episode = { name: 'Floating Points', show_alias: 'floating-points', episode_alias: 'floating-points-3rd-june-2024', broadcast: '2024-06-03', audio_sources: [{ url: 'https://soundcloud.com/nts/floating-points-2024?share=1' }] };
const fixture = async url => {
  const path = new URL(url).pathname;
  if (path === '/api/v2/search') return json({ results: [{ article_type: 'show', title: 'Floating Points', article: { path: '/shows/floating-points' } }, { article_type: 'episode', title: 'June episode', article: { path: '/shows/floating-points/episodes/floating-points-3rd-june-2024' } }, { article_type: 'show', title: 'Unsafe', article: { path: '/shows/%2e%2e' } }] });
  if (path.endsWith('/episodes')) return json({ results: [episode] });
  return json(episode);
};
test('bounded NTS search and show drill-down normalize paths and metadata', async () => {
  const search = await searchArchive(' Floating Points ', fixture);
  assert.equal(search.items.length, 2);
  assert.deepEqual(search.items.map(x => x.kind), ['show', 'episode']);
  assert.equal(search.items[1].url, 'https://www.nts.live/shows/floating-points/episodes/floating-points-3rd-june-2024');
  const list = await showEpisodes('floating-points', fixture);
  assert.equal(list.items[0].audioSource, 'soundcloud');
  const detail = await episodeDetail('floating-points', 'floating-points-3rd-june-2024', fixture);
  assert.equal(new URL(detail.source).hostname, 'soundcloud.com');
});
test('unsafe input and changed provider schema fail closed', async () => {
  assert.throws(() => validQuery('  '));
  assert.throws(() => validQuery('a'.repeat(121)));
  assert.throws(() => validQuery('x\ny'));
  await assert.rejects(showEpisodes('../x', fixture));
  await assert.rejects(searchArchive('hello', async () => json({ unexpected: [] })), /changed format/);
  assert.equal(safeSoundCloud('https://soundcloud.com.evil.test/x/y'), null);
  assert.equal(safeSoundCloud('https://soundcloud.com:444/x/y'), null);
  assert.equal(safeSoundCloud('http://soundcloud.com/x/y'), null);
});
test('signed media candidates require one exact origin, path and fresh expiry', () => {
  const good = `${ARCHIVE_ORIGIN}/a/playlist.m3u8?expires=${Math.floor(Date.now()/1000)+600}&Signature=secret`;
  assert.equal(validateMediaCandidate({ format: 'hls', url: good }).format, 'hls');
  assert.equal(validateMediaCandidate({ format: 'hls', url: good.replace(ARCHIVE_ORIGIN, 'https://evil.test') }), null);
  assert.equal(validateMediaCandidate({ format: 'hls', url: good.replace('playlist.m3u8', 'other.m3u8') }), null);
  assert.equal(validateMediaCandidate({ format: 'hls', url: good.replace(/expires=\d+/, 'expires=1') }), null);
});
test('manifest rejects cross-origin segment before exposing a candidate', async () => {
  const media = `${ARCHIVE_ORIGIN}/a/playlist.m3u8?expires=${Math.floor(Date.now()/1000)+600}`;
  const fetcher = async url => String(url).includes('/api/v2/') ? fixture(url) : new Response('#EXTM3U\n#EXTINF:10,\nhttps://evil.test/segment.m4s\n');
  assert.equal(await validateManifest(media, fetcher), false);
  const result = await resolveEpisode('floating-points', 'floating-points-3rd-june-2024', fetcher, async () => ({ format: 'hls', url: media }));
  assert.equal(result.candidate, null);
});
