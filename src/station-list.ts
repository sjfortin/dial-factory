import { parseMediaUrl } from './media-policy.js';

export type Row = { id: string; name: string; countryCode: string; streamUrl: string; origin: string; codec?: string; bitrate?: number; clickToken: string };
export type Results = { kind?: 'initial' | 'continuation'; pageIndex?: number; status: string; countryCode: string; searchedCount: number; limit: number; stations: Row[] };
function safeRow(value: unknown, countryCode: string): value is Row {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Row>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.streamUrl !== 'string' || typeof row.origin !== 'string' || typeof row.clickToken !== 'string' || row.countryCode !== countryCode) return false;
  const url = parseMediaUrl(row.streamUrl);
  return url !== null && url.origin === row.origin;
}

export function createStationCatalog(list: HTMLElement, summary: HTMLElement, toggle: HTMLButtonElement, select: (row: Row) => void) {
  let country = '';
  let rows: Row[] = [];
  let selectedId = '';
  let pageIndex = 0;
  let canMore = false;
  let error = '';
  let generation = 0;
  let inspected: string[] = [];
  const loaded = new Set<number>();
  function paint() {
    list.replaceChildren();
    summary.textContent = error || `${rows.length} supported stations for ${country}. Inspected provider rows ${inspected.join(', ')}. ${canMore ? 'More stations may be available.' : 'Bounded scan complete.'} Select one, then press Play. Results can change between requests.`;
    for (const row of rows) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'station-option';
      button.setAttribute('aria-label', `Select ${row.name}`);
      button.setAttribute('aria-pressed', String(row.id.toLowerCase() === selectedId));
      const copy = document.createElement('span');
      copy.className = 'station-option-copy';
      const name = document.createElement('span');
      name.className = 'station-option-name';
      name.textContent = row.name;
      const metadata = document.createElement('span');
      metadata.className = 'metadata';
      metadata.textContent = [row.countryCode, row.codec, typeof row.bitrate === 'number' ? `${row.bitrate} kbps` : null].filter(Boolean).join(' · ');
      const check = document.createElement('span');
      check.className = 'station-option-check';
      check.textContent = '✓';
      check.setAttribute('aria-hidden', 'true');
      copy.append(name, metadata);
      button.append(copy, check);
      button.addEventListener('click', () => {
        selectedId = row.id.toLowerCase();
        for (const option of list.querySelectorAll('button.station-option')) option.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-pressed', 'true');
        select(row);
        toggle.disabled = false;
      });
      item.append(button);
      list.append(item);
    }
  }
  function receive(value: unknown, expectedGeneration?: number): 'initial' | 'continuation' | 'ignored' {
    if (!value || typeof value !== 'object') return 'ignored';
    const result = value as Partial<Results>;
    if (typeof result.status !== 'string' || typeof result.countryCode !== 'string') return 'ignored';
    const continuation = result.kind === 'continuation';
    const nextPage = result.pageIndex ?? 0;
    if (continuation && expectedGeneration !== generation) return 'ignored';
    if (continuation && (result.countryCode !== country || nextPage !== pageIndex + 1 || loaded.has(nextPage))) return 'ignored';
    if (!continuation) {
      generation++;
      country = result.countryCode;
      rows = [];
      selectedId = '';
      pageIndex = 0;
      inspected = [];
      loaded.clear();
      loaded.add(0);
      toggle.disabled = true;
    }
    if (result.status === 'provider_unavailable') {
      error = continuation ? `Could not load provider rows ${nextPage * 50 + 1}–${(nextPage + 1) * 50}. Retry More stations.` : 'Radio Browser is unavailable. Try the country request again.';
      if (!continuation) canMore = false;
      paint();
      return continuation ? 'continuation' : 'initial';
    }
    if (result.status === 'invalid_country') { error = 'Invalid country code. Use an assigned two-letter code such as FR.'; canMore = false; paint(); return 'initial'; }
    if (!['ok', 'no_stations', 'no_supported_stations'].includes(result.status) || !Array.isArray(result.stations)) return 'ignored';
    error = '';
    const ids = new Set(rows.map(row => row.id.toLowerCase()));
    const urls = new Set(rows.map(row => new URL(row.streamUrl).href));
    for (const row of result.stations.slice(0, 10)) {
      if (!safeRow(row, country)) continue;
      const url = new URL(row.streamUrl).href;
      if (ids.has(row.id.toLowerCase()) || urls.has(url)) continue;
      rows.push(row);
      ids.add(row.id.toLowerCase());
      urls.add(url);
      if (rows.length === 30) break;
    }
    pageIndex = nextPage;
    loaded.add(pageIndex);
    const start = pageIndex * 50 + 1;
    const count = typeof result.searchedCount === 'number' && Number.isInteger(result.searchedCount) ? Math.max(0, Math.min(50, result.searchedCount)) : 0;
    inspected.push(count ? `${start}–${start + count - 1}` : `none in requested window ${start}–${start + 49}`);
    canMore = pageIndex < 2 && result.searchedCount === 50 && rows.length < 30;
    paint();
    return continuation ? 'continuation' : 'initial';
  }
  return { receive, get generation() { return generation; }, get country() { return country; }, get nextPage() { return canMore ? pageIndex + 1 : null; }, get rows() { return [...rows]; }, get selectedId() { return selectedId; } };
}

export function renderStations(value: unknown, list: HTMLElement, summary: HTMLElement, toggle: HTMLButtonElement, select: (row: Row) => void) {
  createStationCatalog(list, summary, toggle, select).receive(value);
}
