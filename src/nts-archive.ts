import { spawn } from 'node:child_process';

const API = 'https://www.nts.live/api/v2';
export const ARCHIVE_ORIGIN = 'https://playback.media-streaming.soundcloud.cloud';
const aliasPattern = /^[a-z0-9-]{1,100}$/;
type RecordLike = Record<string, unknown>;
export type ArchiveItem = { kind: 'show' | 'episode'; title: string; show: string; date: string; description: string; showAlias: string; episodeAlias?: string; url: string; audioSource: 'soundcloud' | 'unavailable' };
export type ArchiveResults = { kind: 'nts-search' | 'nts-episodes'; status: 'ok' | 'empty' | 'error'; items: ArchiveItem[]; query?: string; showAlias?: string; message?: string };
export type MediaCandidate = { format: 'hls' | 'direct'; url: string; expires?: number };
const object = (value: unknown): RecordLike => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordLike : {};
const str = (value: unknown, cap: number): string => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, cap) : '';
export const validAlias = (value: string): boolean => aliasPattern.test(value);
export function validQuery(value: string): string {
  const query = value.trim();
  if (!query || Array.from(query).length > 120 || /[\u0000-\u001f\u007f]/.test(query)) throw new Error('Enter a search phrase of 1–120 characters.');
  return query;
}
function itemFromSearch(value: unknown): ArchiveItem | null {
  const row = object(value);
  const kind = row.article_type;
  const path = object(row.article).path;
  if (kind !== 'show' && kind !== 'episode' || typeof path !== 'string') return null;
  const match = kind === 'show' ? /^\/shows\/([a-z0-9-]{1,100})$/.exec(path) : /^\/shows\/([a-z0-9-]{1,100})\/episodes\/([a-z0-9-]{1,100})$/.exec(path);
  if (!match) return null;
  const showAlias = match[1], episodeAlias = match[2];
  const title = str(row.title, 120);
  if (!title) return null;
  return { kind, title, show: kind === 'show' ? title : str(object(row.related_episode).name, 120), date: str(row.local_date, 40),
    description: str(object(row.description).highlight_plain, 240), showAlias, ...(episodeAlias ? { episodeAlias } : {}),
    url: `https://www.nts.live${path}`, audioSource: 'unavailable' };
}
function itemFromEpisode(value: unknown, expectedShow: string): ArchiveItem | null {
  const row = object(value), showAlias = row.show_alias, episodeAlias = row.episode_alias;
  if (showAlias !== expectedShow || typeof episodeAlias !== 'string' || !validAlias(episodeAlias)) return null;
  const title = str(row.name, 120);
  if (!title) return null;
  const sources = Array.isArray(row.audio_sources) ? row.audio_sources : [];
  return { kind: 'episode', title, show: str(row.show_name, 120), date: str(row.broadcast, 40), description: str(row.description, 240), showAlias, episodeAlias,
    url: `https://www.nts.live/shows/${showAlias}/episodes/${episodeAlias}`,
    audioSource: sources.some(source => safeSoundCloud(object(source).url)) ? 'soundcloud' : 'unavailable' };
}
async function getJson(path: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(`${API}${path}`, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
  if (!response.ok || !(response.headers.get('content-type') ?? '').toLowerCase().includes('json')) throw new Error('NTS metadata unavailable.');
  const length = Number(response.headers.get('content-length'));
  if (length > 256 * 1024) throw new Error('NTS metadata too large.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('NTS metadata unavailable.');
  let bytes = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 256 * 1024) throw new Error('NTS metadata too large.'); chunks.push(value); } }
  finally { reader.releaseLock(); }
  const joined = Buffer.concat(chunks);
  try { return JSON.parse(joined.toString('utf8')); } catch { throw new Error('NTS metadata changed format.'); }
}
function normalizeList(value: unknown, kind: ArchiveResults['kind'], extra: Partial<ArchiveResults>): ArchiveResults {
  const data = object(value);
  if (!Array.isArray(data.results)) throw new Error('NTS metadata changed format.');
  const items = data.results.slice(0, 12).map(row => kind === 'nts-search' ? itemFromSearch(row) : itemFromEpisode(row, extra.showAlias!)).filter((item): item is ArchiveItem => !!item);
  if (data.results.length && !items.length) throw new Error('NTS metadata changed format.');
  const unique = [...new Map(items.map(item => [item.url, item])).values()];
  return { kind, status: unique.length ? 'ok' : 'empty', items: unique, ...extra };
}
export async function searchArchive(raw: string, fetcher?: typeof fetch): Promise<ArchiveResults> {
  const query = validQuery(raw);
  const params = new URLSearchParams({ q: query, version: '2', offset: '0', limit: '12' });
  params.append('types[]', 'show'); params.append('types[]', 'episode');
  return normalizeList(await getJson(`/search?${params}`, fetcher), 'nts-search', { query });
}
export async function showEpisodes(showAlias: string, fetcher?: typeof fetch): Promise<ArchiveResults> {
  if (!validAlias(showAlias)) throw new Error('Invalid show.');
  return normalizeList(await getJson(`/shows/${showAlias}/episodes?limit=12&offset=0`, fetcher), 'nts-episodes', { showAlias });
}
export async function episodeDetail(showAlias: string, episodeAlias: string, fetcher?: typeof fetch): Promise<{ item: ArchiveItem; source: string | null }> {
  if (!validAlias(showAlias) || !validAlias(episodeAlias)) throw new Error('Invalid episode.');
  const row = object(await getJson(`/shows/${showAlias}/episodes/${episodeAlias}`, fetcher));
  const item = itemFromEpisode(row, showAlias);
  if (!item || item.episodeAlias !== episodeAlias) throw new Error('NTS episode data changed format.');
  const sources = Array.isArray(row.audio_sources) ? row.audio_sources : [];
  return { item, source: sources.map(source => safeSoundCloud(object(source).url)).find(Boolean) ?? null };
}
export function safeSoundCloud(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 600) return null;
  try { const url = new URL(value); if (url.protocol !== 'https:' || url.hostname !== 'soundcloud.com' || url.username || url.password || url.port || url.hash || !/^\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) return null; return url.href; } catch { return null; }
}
export function validateMediaCandidate(value: unknown): MediaCandidate | null {
  const row = object(value); const raw = row.url;
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== ARCHIVE_ORIGIN || url.username || url.password || url.hash) return null;
    const format = row.format === 'hls' ? 'hls' : row.format === 'direct' ? 'direct' : null;
    if (!format || (format === 'hls' && !/\/playlist\.m3u8$/.test(url.pathname)) || (format === 'direct' && !/\.(mp3|m4a|aac)$/.test(url.pathname))) return null;
    const expiresRaw = url.searchParams.get('expires');
    const expires = expiresRaw === null ? undefined : Number(expiresRaw);
    if (expiresRaw !== null && (!Number.isSafeInteger(expires) || expires! * 1000 <= Date.now() + 60000)) return null;
    return { format, url: url.href, ...(expires === undefined ? {} : { expires }) };
  } catch { return null; }
}
export async function resolveEpisode(showAlias: string, episodeAlias: string, fetcher?: typeof fetch, resolver: (source: string) => Promise<unknown> = runYtDlp): Promise<{ item: ArchiveItem; candidate: MediaCandidate | null }> {
  const { item, source } = await episodeDetail(showAlias, episodeAlias, fetcher);
  if (!source) return { item, candidate: null };
  const candidate = validateMediaCandidate(await resolver(source));
  if (candidate?.format === 'hls' && !(await validateManifest(candidate.url, fetcher))) return { item, candidate: null };
  return { item, candidate };
}
export async function validateManifest(url: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { accept: 'application/vnd.apple.mpegurl' } });
    if (!response.ok || Number(response.headers.get('content-length')) > 1024 * 1024) return false;
    const reader = response.body?.getReader(); if (!reader) return false;
    let bytes = 0, body = '';
    try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 1024 * 1024) return false; body += new TextDecoder().decode(value); } } finally { reader.releaseLock(); }
    if (!body.startsWith('#EXTM3U')) return false;
    const references = body.split(/\r?\n/).flatMap(line => {
      const result: string[] = [];
      if (line && !line.startsWith('#')) result.push(line.trim());
      for (const match of line.matchAll(/URI="([^"]+)"/g)) result.push(match[1]);
      return result;
    });
    if (!references.length) return false;
    return references.every(ref => { try { const parsed = new URL(ref, url); return parsed.origin === ARCHIVE_ORIGIN && !parsed.username && !parsed.password; } catch { return false; } });
  } catch { return false; }
}
async function runYtDlp(source: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/yt-dlp', ['--ignore-config', '--no-playlist', '--no-warnings', '--socket-timeout', '8', '--retries', '0', '--extractor-retries', '0', '-f', 'bestaudio[protocol=m3u8_native][vcodec=none]/bestaudio[ext=mp3][vcodec=none]/bestaudio[ext=m4a][vcodec=none]/bestaudio[ext=aac][vcodec=none]', '-g', source], { stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' } });
    let stdout = '', outBytes = 0, errBytes = 0, finished = false;
    const end = (error?: Error, value?: unknown) => { if (finished) return; finished = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill('SIGKILL'); end(new Error('Archive source timed out.')); }, 30000);
    child.stdout.on('data', (chunk: Buffer) => { outBytes += chunk.length; if (outBytes > 16 * 1024) { child.kill('SIGKILL'); end(new Error('Archive source response too large.')); } else stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { errBytes += chunk.length; if (errBytes > 16 * 1024) { child.kill('SIGKILL'); end(new Error('Archive source failed.')); } });
    child.on('error', () => end(new Error('Archive resolver unavailable.')));
    child.on('close', (code) => {
      if (finished) return;
      if (code !== 0) return end(new Error('Archive source unavailable.'));
      const raw = stdout.trim();
      if (raw.includes('\n')) return end(new Error('Archive source changed format.'));
      const format = raw.includes('/playlist.m3u8') ? 'hls' : 'direct';
      end(undefined, validateMediaCandidate({ format, url: raw }) ? { format, url: raw } : null);
    });
  });
}
