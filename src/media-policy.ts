// Exact origins shared by provider filtering, the browser, and the resource CSP.
export const EXISTING_MEDIA_ORIGINS = [
  'https://stream.radioparadise.com',
  'https://audio.bfmtv.com',
  'https://media-ssl.musicradio.com',
  'https://streamer.radio.co',
  'https://icy.unitedradio.it',
  'https://radiomeuh.ice.infomaniak.ch',
  'https://novazz.ice.infomaniak.ch',
  'https://listen.181fm.com',
  'https://streams.radio.co'
] as const;

// DIAL-009: directory rows must still be present and match all three fields.
// These URLs are admissions, not permission for other streams on their hosts.
export const COUNTRY_CANDIDATES = [
  ['US', 'cd477c35-d625-11e8-a54a-52543be04c81', 'https://streaming.radiostreamlive.com/miamibeachradio_devices'],
  ['FR', 'c5bc6ba3-5adf-4bb6-8982-82d53a682799', 'https://jazz-wr17.ice.infomaniak.ch/jazz-wr17-128.mp3'],
  ['JP', '5a2cbfe7-0518-44e9-aca6-0fd41e466ff0', 'https://s10.webradio-hosting.com/proxy/fredradiojp/stream'],
  ['GB', '9619e7d7-0601-11e8-ae97-52543be04c81', 'https://listen-msmn.sharp-stream.com/nme1.mp3'],
  ['CA', 'c682befa-3e57-4db1-b1f2-dfcedb93f4d0', 'https://s3.radio.co/s3b10a57ef/listen'],
  ['DE', '6cddaca1-f2c1-11e8-a471-52543be04c81', 'https://0n-70s.radionetz.de/0n-70s.mp3'],
  ['ES', 'f3081f41-531f-4e38-88bc-8e1a699635c4', 'https://c6.auracast.net/radio/8090/radio.mp3'],
  ['IT', '4df24bb0-2794-498f-bdc0-0c3d6b71ed95', 'https://discofunk.streamingmedia.it/play'],
  ['AU', '3af3be8d-da3e-4051-a604-d5958f410732', 'https://theproganrockmachine.out.airtime.pro/theproganrockmachine_b'],
  ['BR', '193e3072-b88d-4e33-90e7-fb1564713e95', 'https://stream02.ouveai.com.br/8034/stream'],
  ['MX', '7a163be5-9e29-11e9-a787-52543be04c81', 'https://s3.radio.co/s2c1cebae5/listen'],
  ['KR', '7a72aa80-3902-4d73-a548-db81ac780240', 'https://antares.dribbcast.com/proxy/kpop?mp=/s'],
  ['IN', '0db90d9a-4ecc-450c-b8fa-695405b24587', 'https://drive.uber.radio/uber/bollywood2010s/icecast.audio'],
  ['ZA', 'dd493e42-1c7c-4256-8277-53cf61452d88', 'https://live.ecr.co.za/ecrgoldhigh.mp3'],
  ['NL', '0c62b9d7-8de0-4693-9842-6bf9b50229d3', 'https://icecast.omroep.nl/3fm-bb-mp3']
] as const;

// The approved SE Bandit candidate was excluded after independent direct
// verification returned HTTP 500/no bytes (docs/DIAL-009-CANDIDATE-STATUS.md).

const candidateById = new Map<string, readonly [string, string, string]>(COUNTRY_CANDIDATES.map(candidate => [candidate[1], candidate]));
const additionalOrigins = [...new Set(COUNTRY_CANDIDATES.map(candidate => new URL(candidate[2]).origin))];
export const MEDIA_ORIGINS = [...EXISTING_MEDIA_ORIGINS, ...additionalOrigins] as const;

export function matchesCountryCandidate(id: string, countryCode: string, rawUrl: string): boolean {
  const candidate = candidateById.get(id.toLowerCase());
  return !!candidate && candidate[0] === countryCode && candidate[2] === rawUrl;
}

// Inspect the source authority before URL parsing: URL normalizes an explicit
// default :443 port away, but the media policy rejects every explicit port.
export function parseMediaUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null;
  const authority = /^https:\/\/([^/?#\\]+)(?:[/?#]|$)/i.exec(raw)?.[1];
  if (!authority || authority.includes(':')) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !MEDIA_ORIGINS.includes(url.origin as typeof MEDIA_ORIGINS[number])) return null;
    if (/\.(m3u8?|pls|asx)$/i.test(url.pathname)) return null;
    if (!EXISTING_MEDIA_ORIGINS.includes(url.origin as typeof EXISTING_MEDIA_ORIGINS[number]) && !COUNTRY_CANDIDATES.some(candidate => candidate[2] === raw)) return null;
    return url;
  } catch { return null; }
}
