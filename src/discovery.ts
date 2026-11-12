import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ISO_CODES } from './iso-codes.js';
import { parseMediaUrl } from './media-policy.js';
export { MEDIA_ORIGINS } from './media-policy.js';

export const PROVIDER_ORIGIN = 'https://de1.api.radio-browser.info';
const API_TIMEOUT_MS = 5000;
const MAX_BYTES = 512_000;
const ROW_LIMIT = 50;
const STATION_LIMIT = 30;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export type Station = { id: string; name: string; countryCode: string; streamUrl: string; origin: string; codec?: string; bitrate?: number; clickToken: string };
export type ScanWindow = { pageIndex: number; offset: number; searchedCount: number; success: boolean };
export type Discovery = { kind: 'initial' | 'retry'; status: 'invalid_country' | 'provider_unavailable' | 'no_stations' | 'no_supported_stations' | 'ok'; countryCode: string; stations: Station[]; windows: ScanWindow[]; scanState: 'complete' | 'partial' | null; choiceLimitReached: boolean };
type Fetch = typeof fetch;
const signingKey = randomBytes(32);
const OVERRIDES: Readonly<Record<string, string>> = {
  '960a0f41-0601-11e8-ae97-52543be04c81': 'https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3',
  '121cc91e-1f4d-41d5-b7f3-5d09c688fc2f': 'https://novazz.ice.infomaniak.ch/novazz-128.mp3',
  '8a728f88-35f3-4ebf-95bb-46730999bc8a': 'https://novazz.ice.infomaniak.ch/novazz-128.mp3',
  '963fb390-0601-11e8-ae97-52543be04c81': 'https://novazz.ice.infomaniak.ch/novazz-128.mp3'
};

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
  let response: Response | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    response = await fetcher(url, { signal: controller.signal, redirect: 'error', headers: { 'user-agent': 'DialRadioProof/0.2 (MCP country discovery)', accept: 'application/json' } });
    if (!response.ok || !response.body) throw new Error('Provider HTTP failure');
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_BYTES) throw new Error('Provider response too large');
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error('Provider response too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    clearTimeout(timer);
    controller.abort();
    // Start cancellation without letting a stalled provider's cancel promise
    // extend the request beyond its deadline.
    if (reader) void reader.cancel().catch(() => {});
    else if (response?.body) void response.body.cancel().catch(() => {});
  }
}

export async function discover(input: unknown, options: { fetcher?: Fetch; providerOrigin?: string; timeoutMs?: number; now?: number; kind?: 'initial' | 'retry' } = {}): Promise<Discovery> {
  const countryCode = normalizeCountry(input);
  const base: Discovery = { kind: options.kind ?? 'initial', status: 'invalid_country', countryCode: countryCode ?? '', stations: [], windows: [], scanState: null, choiceLimitReached: false };
  if (!countryCode) return base;
  const stations: Station[] = [];
  const windows: ScanWindow[] = [];
  const ids = new Set<string>();
  const urls = new Set<string>();
  let rawCount = 0;
  let origin: string;
  try { origin = validateProviderOrigin(options.providerOrigin ?? PROVIDER_ORIGIN); }
  catch { return { ...base, status: 'provider_unavailable', scanState: 'partial', windows: [0, 1, 2].map(pageIndex => ({ pageIndex, offset: pageIndex * ROW_LIMIT, searchedCount: 0, success: false })) }; }
  for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
    const window: ScanWindow = { pageIndex, offset: pageIndex * ROW_LIMIT, searchedCount: 0, success: false };
    windows.push(window);
    try {
    const url = new URL(`/json/stations/bycountrycodeexact/${countryCode}`, origin);
    url.search = new URLSearchParams({ order: 'votes', reverse: 'true', offset: String(pageIndex * ROW_LIMIT), limit: '50', hidebroken: 'true' }).toString();
    const json = await boundedJson(url.href, options.fetcher ?? fetch, options.timeoutMs ?? API_TIMEOUT_MS);
    if (!Array.isArray(json)) throw new Error('Provider response is not an array');
    const rows = json.slice(0, ROW_LIMIT);
    window.success = true;
    window.searchedCount = rows.length;
    rawCount += rows.length;
    for (const row of rows) {
      if (stations.length >= STATION_LIMIT) continue;
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const rawId = item.stationuuid;
      const name = item.name;
      const code = typeof item.countrycode === 'string' ? item.countrycode.trim().toUpperCase() : '';
      const codec = typeof item.codec === 'string' ? item.codec.trim().toUpperCase() : '';
      const id = typeof rawId === 'string' ? rawId.toLowerCase() : '';
      const resolved = Object.hasOwn(OVERRIDES, id) ? OVERRIDES[id] : typeof item.url_resolved === 'string' && item.url_resolved.trim() ? item.url_resolved : item.url;
      const media = parseMediaUrl(resolved);
      if (typeof rawId !== 'string' || !UUID.test(rawId) || typeof name !== 'string' || !name.trim() || code !== countryCode || codec !== 'MP3' || !media || ids.has(id) || urls.has(media.href)) continue;
      ids.add(id);
      urls.add(media.href);
      const station: Station = { id, name: name.trim().slice(0, 120), countryCode, streamUrl: media.href, origin: media.origin, codec: 'MP3', clickToken: tokenFor(id, (options.now ?? Date.now()) + 5 * 60_000) };
      if (typeof item.bitrate === 'number' && Number.isInteger(item.bitrate) && item.bitrate > 0 && item.bitrate <= 1000) station.bitrate = item.bitrate;
      stations.push(station);
    }
    } catch { /* Later bounded windows can still contribute. */ }
  }
  const scanState = windows.every(window => window.success) ? 'complete' : 'partial';
  const status = stations.length ? 'ok' : scanState === 'partial' ? 'provider_unavailable' : rawCount ? 'no_supported_stations' : 'no_stations';
  return { ...base, status, stations, windows, scanState, choiceLimitReached: stations.length === STATION_LIMIT };
}

export async function reportClick(token: unknown, options: { fetcher?: Fetch; providerOrigin?: string; timeoutMs?: number } = {}): Promise<boolean> {
  const id = tokenStationId(token);
  if (!id) return false;
  try {
    const origin = validateProviderOrigin(options.providerOrigin ?? PROVIDER_ORIGIN);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 1500);
    try {
      const response = await (options.fetcher ?? fetch)(`${origin}/json/url/${id}`, { signal: controller.signal, redirect: 'error', headers: { 'user-agent': 'DialRadioProof/0.2 (MCP playback count)' } });
      if (response.body) void response.body.cancel().catch(() => {});
      return response.ok;
    } finally { clearTimeout(timer); controller.abort(); }
  } catch { return false; }
}
