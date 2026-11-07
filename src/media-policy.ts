// Exact origins shared by provider filtering, the browser, and the resource CSP.
export const MEDIA_ORIGINS = [
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
    return url;
  } catch { return null; }
}
