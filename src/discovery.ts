import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ISO_CODES } from './iso-codes.js';

export const MEDIA_ORIGINS = ['https://stream.radioparadise.com', 'https://audio.bfmtv.com', 'https://media-ssl.musicradio.com'] as const;
export const PROVIDER_ORIGIN = 'https://de1.api.radio-browser.info';
const API_TIMEOUT_MS = 5000;
const MAX_BYTES = 512_000;
const ROW_LIMIT = 50;
const STATION_LIMIT = 10;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export type Station = { id: string; name: string; countryCode: string; streamUrl: string; origin: string; codec?: string; bitrate?: number; clickToken: string };
export type Discovery = { status: 'invalid_country' | 'provider_unavailable' | 'no_stations' | 'no_supported_stations' | 'ok'; countryCode: string; searchedCount: number; limit: 50; stations: Station[] };
type Fetch = typeof fetch;
const signingKey = randomBytes(32);

export function normalizeCountry(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase();
  return ISO_CODES.has(code) ? code : null;
}

export function validateProviderOrigin(input: string): string {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw new Error('RADIO_BROWSER_API_ORIGIN must be an HTTPS origin');
  return url.origin;
}

function streamUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !MEDIA_ORIGINS.includes(url.origin as typeof MEDIA_ORIGINS[number])) return null;
    if (/\.(m3u8?|pls|asx)(?:$|[?])/i.test(url.pathname)) return null;
    return url;
  } catch { return null; }
}

function tokenFor(id: string, expiry: number): string {
  const payload = `${id}.${expiry}`;
  const mac = createHmac('sha256', signingKey).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function tokenStationId(token: unknown, now = Date.now()): string | null {
  if (typeof token !== 'string' || token.length > 180) return null;
  const match = /^([a-f0-9-]{36})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || !UUID.test(match[1])) return null;
  const expiry = Number(match[2]);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + 10 * 60_000) return null;
  const expected = createHmac('sha256', signingKey).update(`${match[1]}.${match[2]}`).digest();
  const actual = Buffer.from(match[3], 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? match[1] : null;
}

async function boundedJson(url: string, fetcher: Fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { signal: controller.signal, headers: { 'user-agent': 'DialRadioProof/0.2 (MCP country discovery)', accept: 'application/json' } });
    if (!response.ok || !response.body) throw new Error('Provider HTTP failure');
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_BYTES) throw new Error('Provider response too large');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Provider response too large'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { clearTimeout(timer); }
}

export async function discover(input: unknown, options: { fetcher?: Fetch; providerOrigin?: string; timeoutMs?: number; now?: number } = {}): Promise<Discovery> {
  const countryCode = normalizeCountry(input);
  const base: Discovery = { status: 'invalid_country', countryCode: countryCode ?? '', searchedCount: 0, limit: ROW_LIMIT, stations: [] };
  if (!countryCode) return base;
  try {
    const origin = validateProviderOrigin(options.providerOrigin ?? PROVIDER_ORIGIN);
    const url = new URL(`/json/stations/bycountrycodeexact/${countryCode}`, origin);
    url.search = new URLSearchParams({ order: 'votes', reverse: 'true', offset: '0', limit: '50', hidebroken: 'true' }).toString();
    const json = await boundedJson(url.href, options.fetcher ?? fetch, options.timeoutMs ?? API_TIMEOUT_MS);
    if (!Array.isArray(json)) throw new Error('Provider response is not an array');
    const rows = json.slice(0, ROW_LIMIT);
    const stations: Station[] = [];
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const id = item.stationuuid;
      const name = item.name;
      const code = typeof item.countrycode === 'string' ? item.countrycode.trim().toUpperCase() : '';
      const codec = typeof item.codec === 'string' ? item.codec.trim().toUpperCase() : '';
      const resolved = typeof item.url_resolved === 'string' && item.url_resolved.trim() ? item.url_resolved : item.url;
      const media = streamUrl(resolved);
      if (typeof id !== 'string' || !UUID.test(id) || typeof name !== 'string' || !name.trim() || code !== countryCode || codec !== 'MP3' || !media || ids.has(id.toLowerCase())) continue;
      ids.add(id.toLowerCase());
      const station: Station = { id, name: name.trim().slice(0, 120), countryCode, streamUrl: media.href, origin: media.origin, codec: 'MP3', clickToken: tokenFor(id, (options.now ?? Date.now()) + 5 * 60_000) };
      if (typeof item.bitrate === 'number' && Number.isInteger(item.bitrate) && item.bitrate > 0 && item.bitrate <= 1000) station.bitrate = item.bitrate;
      stations.push(station);
      if (stations.length === STATION_LIMIT) break;
    }
    return { ...base, status: !rows.length ? 'no_stations' : !stations.length ? 'no_supported_stations' : 'ok', searchedCount: rows.length, stations };
  } catch { return { ...base, status: 'provider_unavailable' }; }
}

export async function reportClick(token: unknown, options: { fetcher?: Fetch; providerOrigin?: string; timeoutMs?: number } = {}): Promise<boolean> {
  const id = tokenStationId(token);
  if (!id) return false;
  try {
    const origin = validateProviderOrigin(options.providerOrigin ?? PROVIDER_ORIGIN);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);
    try {
      const response = await (options.fetcher ?? fetch)(`${origin}/json/url/${id}`, { signal: controller.signal, headers: { 'user-agent': 'DialRadioProof/0.2 (MCP playback count)' } });
      await response.body?.cancel();
      return response.ok;
    } finally { clearTimeout(timer); }
  } catch { return false; }
}
