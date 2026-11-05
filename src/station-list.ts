export type Row = { id: string; name: string; countryCode: string; streamUrl: string; origin: string; codec?: string; bitrate?: number; clickToken: string };
export type Results = { status: string; countryCode: string; searchedCount: number; limit: number; stations: Row[] };
const allowed = new Set(['https://stream.radioparadise.com', 'https://audio.bfmtv.com', 'https://media-ssl.musicradio.com']);
function safeRow(value: unknown, countryCode: string): value is Row {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Row>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.streamUrl !== 'string' || typeof row.origin !== 'string' || typeof row.clickToken !== 'string' || row.countryCode !== countryCode) return false;
  try {
    const url = new URL(row.streamUrl);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && url.origin === row.origin && allowed.has(url.origin);
  } catch { return false; }
}
export function renderStations(value: unknown, list: HTMLElement, summary: HTMLElement, toggle: HTMLButtonElement, select: (row: Row) => void) {
  if (!value || typeof value !== 'object') return;
  const result = value as Partial<Results>;
  const country = typeof result.countryCode === 'string' ? result.countryCode : '';
  list.replaceChildren();
  toggle.disabled = true;
  if (result.status === 'invalid_country') { summary.textContent = 'Invalid country code. Use an assigned two-letter code such as FR.'; return; }
  if (result.status === 'provider_unavailable') { summary.textContent = 'Radio Browser is unavailable. Try the country request again.'; return; }
  if (result.status === 'no_stations') { summary.textContent = `No stations in the first 50 results for ${country}.`; return; }
  if (result.status === 'no_supported_stations') { summary.textContent = `No supported stations in the first 50 results for ${country}.`; return; }
  if (result.status !== 'ok' || !Array.isArray(result.stations)) return;
  const rows = result.stations.slice(0, 10).filter((row) => safeRow(row, country));
  summary.textContent = `${rows.length} supported stations for ${country} from the first 50 provider results. Select one, then press Play.`;
  for (const row of rows) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Select ${row.name}`;
    button.setAttribute('aria-label', `Select ${row.name}`);
    button.addEventListener('click', () => { select(row); toggle.disabled = false; });
    const metadata = document.createElement('span');
    metadata.className = 'metadata';
    metadata.textContent = [row.countryCode, row.codec, typeof row.bitrate === 'number' ? `${row.bitrate} kbps` : null].filter(Boolean).join(' · ');
    item.append(button, metadata);
    list.append(item);
  }
}
