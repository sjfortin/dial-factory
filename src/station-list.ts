import { parseMediaUrl } from './media-policy.js';

export type Row = { id: string; name: string; countryCode: string; streamUrl: string; origin: string; codec?: string; bitrate?: number; clickToken: string };
type Window = { pageIndex: number; offset: number; searchedCount: number; success: boolean };
type Results = { kind: 'initial' | 'retry'; status: 'invalid_country' | 'provider_unavailable' | 'no_stations' | 'no_supported_stations' | 'ok'; countryCode: string; stations: Row[]; windows: Window[]; scanState: 'complete' | 'partial' | null; choiceLimitReached: boolean };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function safeRow(value: unknown, countryCode: string): value is Row {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Row>;
  if (typeof row.id !== 'string' || !UUID.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || typeof row.streamUrl !== 'string' || typeof row.origin !== 'string' || typeof row.clickToken !== 'string' || row.countryCode !== countryCode || row.codec !== 'MP3') return false;
  const url = parseMediaUrl(row.streamUrl);
  return url !== null && url.origin === row.origin;
}

function validResult(value: unknown): value is Results {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<Results>;
  if (!['initial', 'retry'].includes(result.kind ?? '') || typeof result.countryCode !== 'string' || !Array.isArray(result.stations) || !Array.isArray(result.windows) || typeof result.choiceLimitReached !== 'boolean') return false;
  if (!['ok', 'invalid_country', 'provider_unavailable', 'no_stations', 'no_supported_stations'].includes(result.status ?? '')) return false;
  if (result.status === 'invalid_country') return result.scanState === null && result.windows.length === 0;
  return ['complete', 'partial'].includes(result.scanState ?? '') && result.windows.length === 3 && result.windows.every((window, index) => window && window.pageIndex === index && window.offset === index * 50 && Number.isInteger(window.searchedCount) && window.searchedCount >= 0 && window.searchedCount <= 50 && typeof window.success === 'boolean');
}

export function createStationCatalog(list: HTMLElement, summary: HTMLElement, toggle: HTMLButtonElement, select: (row: Row) => void) {
  let country = '';
  let rows: Row[] = [];
  let visibleCount = 0;
  let selectedId = '';
  let generation = 0;
  let scanState: 'complete' | 'partial' | null = null;
  let choiceLimitReached = false;
  let windows: Window[] = [];
  let status: Results['status'] = 'invalid_country';
  let retried = false;
  let loadError = '';
  function paint() {
    list.replaceChildren();
    const scanned = windows.reduce((total, window) => total + window.searchedCount, 0);
    if (loadError) summary.textContent = loadError;
    else if (status === 'invalid_country') summary.textContent = 'Invalid country code. Use an assigned two-letter code such as FR.';
    else {
      const state = scanState === 'partial' ? 'Latest scan incomplete. Retry scan to check failed windows.' : 'Latest scan completed three bounded provider windows.';
      const limit = choiceLimitReached ? '30-choice catalog limit reached.' : '';
      const empty = status === 'provider_unavailable' ? 'Latest scan: provider unavailable in at least one window.' : status === 'no_stations' ? 'Latest scan: no provider rows in these windows.' : status === 'no_supported_stations' ? 'Latest scan: no compatible choices in these windows.' : '';
      const count = retried ? `${rows.length} retained compatible catalog choices for ${country}` : `${rows.length} compatible catalog choices for ${country}`;
      summary.textContent = `${count}; ${visibleCount} shown; latest scan inspected ${scanned} provider rows. ${state} ${limit} ${empty} A catalog choice may not play. Select one, then press Play.`;
    }
    for (const row of rows.slice(0, visibleCount)) {
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
  function append(stations: Row[]) {
    const ids = new Set(rows.map(row => row.id.toLowerCase()));
    const urls = new Set(rows.map(row => new URL(row.streamUrl).href));
    for (const row of stations) {
      if (rows.length >= 30) break;
      if (!safeRow(row, country)) continue;
      const id = row.id.toLowerCase();
      const url = new URL(row.streamUrl).href;
      if (ids.has(id) || urls.has(url)) continue;
      rows.push(row); ids.add(id); urls.add(url);
    }
  }
  function receive(value: unknown, expectedGeneration?: number): 'initial' | 'retry' | 'ignored' {
    if (!validResult(value)) return 'ignored';
    if (value.kind === 'retry' && (expectedGeneration !== generation || value.countryCode !== country)) return 'ignored';
    if (value.kind === 'initial') {
      generation++;
      country = value.countryCode;
      rows = [];
      visibleCount = 0;
      selectedId = '';
      choiceLimitReached = false;
      retried = false;
      toggle.disabled = true;
    } else retried = true;
    status = value.status;
    scanState = value.scanState;
    choiceLimitReached = choiceLimitReached || value.choiceLimitReached;
    windows = value.windows;
    loadError = '';
    append(value.stations);
    choiceLimitReached = choiceLimitReached || rows.length === 30;
    if (value.kind === 'initial') visibleCount = Math.min(8, rows.length);
    paint();
    return value.kind;
  }
  function reveal() {
    if (visibleCount >= rows.length) return false;
    visibleCount = Math.min(rows.length, visibleCount + 8);
    paint();
    return true;
  }
  function error(message: string) { loadError = message; paint(); }
  return { receive, reveal, error, get generation() { return generation; }, get country() { return country; }, get canMore() { return visibleCount < rows.length; }, get canRetry() { return scanState === 'partial'; }, get rows() { return [...rows]; }, get selectedId() { return selectedId; } };
}

export function renderStations(value: unknown, list: HTMLElement, summary: HTMLElement, toggle: HTMLButtonElement, select: (row: Row) => void) {
  createStationCatalog(list, summary, toggle, select).receive(value);
}
