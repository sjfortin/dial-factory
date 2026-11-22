import { App } from '@modelcontextprotocol/ext-apps';
import { installPlayer } from './player-controller.js';
import { createStationCatalog } from './station-list.js';
import { NTS_CHANNELS } from './nts-policy.js';
import { rememberPauseRequest } from './pause-request.js';

const audio = document.querySelector<HTMLAudioElement>('#radio')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
const remoteButton = document.querySelector<HTMLButtonElement>('#remote-pause');
const remoteStatus = document.querySelector<HTMLElement>('#remote-status');
const app = new App({ name: 'dial-radio-player', version: '0.2.0' });
const list = document.querySelector<HTMLElement>('#stations');
const summary = document.querySelector<HTMLElement>('#summary');
const more = document.querySelector<HTMLButtonElement>('#more-stations');
const retry = document.querySelector<HTMLButtonElement>('#retry-scan');
const stationTitle = document.querySelector<HTMLElement>('#station-title');
const stationSubtitle = document.querySelector<HTMLElement>('#station-subtitle');
const preparedBar = document.querySelector<HTMLElement>('#nts-prepared');
const preparedName = document.querySelector<HTMLElement>('#nts-prepared-name');
const preparedPlay = document.querySelector<HTMLButtonElement>('#nts-prepared-play');
const countrySelect = document.querySelector<HTMLSelectElement>('#country-select');
const countriesTab = document.querySelector<HTMLButtonElement>('#countries-tab');
const ntsTab = document.querySelector<HTMLButtonElement>('#nts-tab');
const countriesPanel = document.querySelector<HTMLElement>('#countries-panel');
const ntsPanel = document.querySelector<HTMLElement>('#nts-panel');
const countryAttribution = document.querySelector<HTMLElement>('#country-attribution');
const archiveQuery = document.querySelector<HTMLInputElement>('#archive-query');
const archiveSearch = document.querySelector<HTMLButtonElement>('#archive-search-button');
const archiveResults = document.querySelector<HTMLElement>('#archive-results');
const archiveStatus = document.querySelector<HTMLElement>('#archive-status');
const archiveLink = document.querySelector<HTMLAnchorElement>('#archive-link');
const pausePanel = document.querySelector<HTMLElement>('#pause-panel');
const playerSection = document.querySelector<HTMLElement>('#player-section');
const pauseStatus = document.querySelector<HTMLElement>('#pause-status');
const pauseRetry = document.querySelector<HTMLButtonElement>('#pause-retry');
type ArchiveItem = { kind: 'show' | 'episode'; title: string; show: string; date: string; showAlias: string; episodeAlias?: string; url: string; audioSource: string };
type ArchiveResult = { kind?: string; status?: string; items?: ArchiveItem[]; query?: string; launchMode?: string; channel?: string; requestId?: string; issuedAt?: number };
const player = installPlayer(audio, toggle, status, {
  onSelectionChange: (active, prepared) => {
    if (preparedBar) preparedBar.hidden = !prepared;
    if (preparedName) preparedName.textContent = prepared ? `${prepared.name} ready` : '';
    if (preparedPlay) preparedPlay.setAttribute('aria-label', prepared ? `Play ${prepared.name}` : 'Play prepared NTS channel');
    if (active?.source === 'nts' && !active.archive) {
      if (stationTitle) stationTitle.textContent = active.name;
      if (stationSubtitle) stationSubtitle.textContent = 'NTS · live channel · experimental playback';
    }
  },
  coordination: {
    locks: navigator.locks,
    channel: (name) => new BroadcastChannel(name)
  },
  remoteButton, remoteStatus,
  seek: document.querySelector<HTMLInputElement>('#archive-seek'),
  time: document.querySelector<HTMLElement>('#archive-time'),
  resolveArchive: async (showAlias, episodeAlias) => {
    const result = await app.callServerTool({ name: 'resolve_nts_episode', arguments: { showAlias, episodeAlias } });
    const meta = result._meta as { dialMedia?: { format?: string; url?: string; expires?: number } } | undefined;
    const candidate = meta?.dialMedia;
    if (!candidate || (candidate.format !== 'hls' && candidate.format !== 'direct') || typeof candidate.url !== 'string') return null;
    const url = new URL(candidate.url);
    if (url.origin !== 'https://playback.media-streaming.soundcloud.cloud') return null;
    return { format: candidate.format, url: candidate.url, expires: candidate.expires };
  },
  onPlaying: (clickToken) => {
    void app.callServerTool({ name: 'report_station_click', arguments: { clickToken } }).catch(() => {});
  }
});
preparedPlay?.addEventListener('click', () => player.playPrepared());
if (list && summary) {
  let selectedSource: 'country' | 'nts' | null = null;
  const catalog = createStationCatalog(list, summary, toggle, (row) => {
    selectedSource = 'country';
    if (countryAttribution) countryAttribution.hidden = false;
    ntsPanel?.querySelectorAll<HTMLButtonElement>('.nts-option').forEach(option => option.setAttribute('aria-pressed', 'false'));
    player.selectStation(row);
    if (stationTitle) stationTitle.textContent = row.name;
    if (stationSubtitle) stationSubtitle.textContent = [row.countryCode, row.codec, typeof row.bitrate === 'number' ? `${row.bitrate} kbps` : null].filter(Boolean).join(' · ');
  });
  let pending: { generation: number; countryCode: string } | null = null;
  let countryRequestSerial = 0;
  let activeCountryRequest: number | null = null;
  const showCollection = (collection: 'countries' | 'nts') => {
    if (countriesPanel) countriesPanel.hidden = collection !== 'countries';
    if (ntsPanel) ntsPanel.hidden = collection !== 'nts';
    if (countryAttribution) countryAttribution.hidden = selectedSource === 'nts' || (collection !== 'countries' && selectedSource !== 'country');
    countriesTab?.setAttribute('aria-selected', String(collection === 'countries'));
    ntsTab?.setAttribute('aria-selected', String(collection === 'nts'));
    if (pausePanel) pausePanel.hidden = true;
    if (playerSection) playerSection.hidden = false;
  };
  countriesTab?.addEventListener('click', () => { supersede(); showCollection('countries'); });
  ntsTab?.addEventListener('click', () => { supersede(); showCollection('nts'); });
  for (const [tab, other] of [[countriesTab, ntsTab], [ntsTab, countriesTab]] as const) tab?.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); other?.click(); other?.focus(); }
  });
  ntsPanel?.querySelectorAll<HTMLButtonElement>('.nts-option').forEach(button => button.addEventListener('click', () => {
    const channel = button.dataset.channel;
    if (channel !== '1' && channel !== '2') return;
    const selection = NTS_CHANNELS[channel];
    selectedSource = 'nts';
    catalog.clearSelected();
    player.selectStation({ ...selection, source: 'nts' });
    toggle.disabled = false;
    if (countryAttribution) countryAttribution.hidden = true;
    if (archiveLink) archiveLink.hidden = true;
    for (const option of ntsPanel.querySelectorAll<HTMLButtonElement>('.nts-option')) option.setAttribute('aria-pressed', String(option === button));
  }));
  let archiveSerial = 0;
  const safeItem = (item: ArchiveItem) => item && (item.kind === 'show' || item.kind === 'episode') && /^[a-z0-9-]{1,100}$/.test(item.showAlias) &&
    (item.kind === 'show' || (typeof item.episodeAlias === 'string' && /^[a-z0-9-]{1,100}$/.test(item.episodeAlias))) &&
    item.url === `https://www.nts.live/shows/${item.showAlias}${item.kind === 'episode' ? `/episodes/${item.episodeAlias}` : ''}`;
  const showArchive = (result: ArchiveResult) => {
    if (!archiveResults || !archiveStatus) return;
    archiveResults.replaceChildren();
    if (result.status === 'error') { archiveStatus.textContent = 'NTS archive is unavailable or changed format. Try again.'; return; }
    const items = Array.isArray(result.items) ? result.items.filter(safeItem).slice(0, 12) : [];
    archiveStatus.textContent = items.length ? `${items.length} ${result.kind === 'nts-episodes' ? 'recent episodes' : 'show and episode results'} from NTS. Audio availability is checked on Play.` : 'No matching shows or episodes. Try another phrase.';
    for (const item of items) {
      const li = document.createElement('li'); li.className = 'archive-row';
      const button = document.createElement('button'); button.type = 'button';
      const title = document.createElement('strong'); title.textContent = item.title;
      const sub = document.createElement('small'); sub.textContent = [item.kind === 'show' ? 'Show' : 'Episode', item.show && item.kind === 'episode' ? item.show : '', item.date, item.audioSource === 'unavailable' && item.kind === 'episode' ? 'Audio availability checked on Play' : ''].filter(Boolean).join(' · ');
      button.append(title, sub);
      button.addEventListener('click', () => {
        if (item.kind === 'show') {
          supersede();
          const serial = ++archiveSerial;
          archiveStatus.textContent = `Loading episodes for ${item.title}…`;
          void app.callServerTool({ name: 'list_nts_show_episodes', arguments: { showAlias: item.showAlias } }).then(response => { if (serial === archiveSerial) showArchive(response.structuredContent as ArchiveResult); }).catch(() => { if (serial === archiveSerial) archiveStatus.textContent = 'Could not load episodes. Try again.'; });
          return;
        }
        selectedSource = 'nts'; catalog.clearSelected();
        ntsPanel?.querySelectorAll<HTMLButtonElement>('.nts-option').forEach(option => option.setAttribute('aria-pressed', 'false'));
        player.selectStation({ id: `nts:${item.showAlias}:${item.episodeAlias}`, name: item.title, streamUrl: '', source: 'nts', archive: { showAlias: item.showAlias, episodeAlias: item.episodeAlias!, url: item.url } });
        toggle.disabled = false;
        if (stationTitle) stationTitle.textContent = item.title;
        if (stationSubtitle) stationSubtitle.textContent = [item.show || 'NTS', item.date, 'archive episode'].filter(Boolean).join(' · ');
        if (archiveLink) { archiveLink.href = item.url; archiveLink.hidden = false; }
      });
      const link = document.createElement('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open on NTS';
      li.append(button, link); archiveResults.append(li);
    }
  };
  const search = () => {
    const query = archiveQuery?.value.trim() ?? '';
    if (!query || Array.from(query).length > 120) { if (archiveStatus) archiveStatus.textContent = 'Enter 1–120 characters to search.'; return; }
    supersede();
    const serial = ++archiveSerial;
    if (archiveStatus) archiveStatus.textContent = 'Searching NTS…';
    if (archiveSearch) archiveSearch.disabled = true;
    void app.callServerTool({ name: 'search_nts_archive_in_app', arguments: { query } }).then(response => { if (serial === archiveSerial) showArchive(response.structuredContent as ArchiveResult); }).catch(() => { if (serial === archiveSerial && archiveStatus) archiveStatus.textContent = 'NTS search failed. Try again.'; }).finally(() => { if (serial === archiveSerial && archiveSearch) archiveSearch.disabled = false; });
  };
  archiveSearch?.addEventListener('click', search);
  archiveQuery?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
  let pauseRequest = '';
  const seenPauseRequests = new Set<string>();
  const pauseOnce = (requestId: string, userInitiated = false, issuedAt?: number) => {
    if (seenPauseRequests.has(requestId)) return;
    seenPauseRequests.add(requestId);
    pauseRequest = requestId;
    if (countriesPanel) countriesPanel.hidden = true;
    if (ntsPanel) ntsPanel.hidden = true;
    if (playerSection) playerSection.hidden = true;
    if (pausePanel) pausePanel.hidden = false;
    let pauseStore: Storage | undefined;
    try { pauseStore = globalThis.sessionStorage; } catch { /* opaque origin */ }
    const record = rememberPauseRequest(pauseStore, requestId);
    if (!userInitiated && (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt!) > 30_000)) {
      if (pauseStatus) pauseStatus.textContent = 'This Pause card is no longer fresh. Press Pause again to try.';
      return;
    }
    if (!userInitiated && record !== 'new') {
      if (pauseStatus) pauseStatus.textContent = record === 'seen' ? 'This Pause request was already attempted. Check the other thread or press Pause again.' : 'Automatic Pause is unavailable here. Press Pause again to try.';
      return;
    }
    if (pauseStatus) pauseStatus.textContent = player.remoteAvailable() ? 'Requesting Pause from another Dial thread…' : 'This host cannot coordinate Dial playback.';
    const tryPause = (remaining: number) => {
      if (pauseRequest !== requestId) return;
      if (!player.remoteKnown() && remaining > 0 && player.remoteAvailable()) { setTimeout(() => tryPause(remaining - 1), 100); return; }
      void player.pauseRemote().then(ack => { if (pauseRequest === requestId && pauseStatus) pauseStatus.textContent = ack ? 'Pause confirmed by the other Dial thread.' : player.remoteAvailable() ? 'No player found or Pause was not confirmed. Check the other thread.' : 'This host cannot coordinate Dial playback.'; });
    };
    tryPause(5);
  };
  pauseRetry?.addEventListener('click', () => { pauseRequest = ''; pauseOnce(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`, true); });
  document.querySelectorAll?.('#help-examples li')?.forEach(item => {
    const example = item.textContent ?? '';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy'; copy.setAttribute('aria-label', `Copy prompt: ${example}`);
    copy.addEventListener('click', () => { void navigator.clipboard?.writeText(example)?.then(() => { copy.textContent = 'Copied'; }, () => { copy.textContent = 'Select the prompt to copy'; }); });
    item.append(copy);
  });
  function acceptInitial(result: unknown): boolean {
    if (catalog.receive(result) !== 'initial') return false;
    selectedSource = null;
    ntsPanel?.querySelectorAll<HTMLButtonElement>('.nts-option').forEach(option => option.setAttribute('aria-pressed', 'false'));
    player.clearSelection();
    if (stationTitle) stationTitle.textContent = 'Choose a station';
    if (stationSubtitle) stationSubtitle.textContent = 'Select from the stations below';
    if (countrySelect) {
      const code = catalog.country;
      const existing = countrySelect.querySelector<HTMLOptionElement>('option[data-other]');
      existing?.remove();
      if (code && !countrySelect.querySelector(`option[value="${code}"]`)) {
        const option = document.createElement('option'); option.value = code; option.textContent = `Other country · ${code}`; option.dataset.other = 'true'; countrySelect.append(option);
      }
      countrySelect.value = code;
    }
    showCollection('countries');
    refreshControls();
    return true;
  }
  countrySelect?.addEventListener('change', () => {
    const countryCode = countrySelect.value;
    if (!countryCode) return;
    supersede();
    const request = ++countryRequestSerial;
    const requestId = `${Date.now()}-${request}`;
    activeCountryRequest = request;
    pending = null;
    summary.textContent = `Scanning ${countryCode}…`;
    refreshControls();
    let accepted = false;
    void app.callServerTool({ name: 'find_stations_by_country', arguments: { countryCode, requestId } })
      .then(result => {
        if (request !== activeCountryRequest) return;
        const value = result.structuredContent as { kind?: string; countryCode?: string; requestId?: string } | undefined;
        if (value?.kind !== 'initial' || value.countryCode !== countryCode || value.requestId !== requestId || !acceptInitial(value)) catalog.error('Could not load country results. Existing choices remain.');
        else accepted = true;
      })
      .catch(() => { if (request === activeCountryRequest) catalog.error('Country request failed. Existing choices remain.'); })
      .finally(() => {
        if (request !== activeCountryRequest) return;
        activeCountryRequest = null;
        if (!accepted) countrySelect.value = catalog.country;
        refreshControls();
      });
  });
  const refreshControls = () => {
    if (more) more.hidden = !catalog.canMore;
    if (retry) { retry.hidden = !catalog.canRetry; retry.disabled = pending !== null || activeCountryRequest !== null; }
  };
  function supersede() {
    activeCountryRequest = null;
    pending = null;
    archiveSerial++;
    pauseRequest = '';
    if (archiveSearch) archiveSearch.disabled = false;
    refreshControls();
  }
  more?.addEventListener('click', () => {
    catalog.reveal();
    refreshControls();
  });
  retry?.addEventListener('click', () => {
    if (pending || !catalog.canRetry) return;
    const countryCode = catalog.country;
    const request = { generation: catalog.generation, countryCode };
    pending = request;
    refreshControls();
    void app.callServerTool({ name: 'retry_stations_by_country', arguments: { countryCode } })
      .then(result => {
        if (pending !== request || catalog.generation !== request.generation) return;
        const value = result.structuredContent as { kind?: string; countryCode?: string } | undefined;
        if (value?.kind === 'retry' && value.countryCode === countryCode) {
          if (catalog.receive(value, request.generation) === 'ignored') catalog.error('Retry returned an invalid result. Existing choices are unchanged; retry the scan.');
        } else catalog.error('Retry returned an invalid result. Existing choices are unchanged; retry the scan.');
      })
      .catch(() => {
        if (pending === request && catalog.generation === request.generation) catalog.error('Retry failed. Existing choices are unchanged; retry the scan.');
      })
      .finally(() => { if (pending === request) { pending = null; refreshControls(); } });
  });
  app.ontoolresult = (params) => {
    if (!params.structuredContent || typeof params.structuredContent !== 'object') return;
    const result = params.structuredContent as ArchiveResult;
    if (result.launchMode === 'pause-control' && typeof result.requestId === 'string') { if (!seenPauseRequests.has(result.requestId)) { supersede(); pauseOnce(result.requestId, false, result.issuedAt); } return; }
    if (result.launchMode === 'nts' || result.launchMode === 'nts-search') {
      supersede();
      showCollection('nts');
      if (result.channel === '1' || result.channel === '2') ntsPanel?.querySelector<HTMLButtonElement>(`.nts-option[data-channel="${result.channel}"]`)?.click();
      if (result.launchMode === 'nts-search') { if (archiveQuery && typeof result.query === 'string') archiveQuery.value = result.query; showArchive(result); }
      return;
    }
    if (result.launchMode === 'country') { supersede(); showCollection('countries'); }
    // Retry notifications have no request identity. Only the matching promise may merge them.
    if (result.kind === 'retry') return;
    // Picker calls carry an echoed ID. Their correlated promise alone may apply them;
    // late or duplicate notifications must never replace a newer selection.
    if (result.kind !== 'initial' || typeof result.requestId === 'string') return;
    // A fresh chat request supersedes any in-flight picker request.
    if (!result.launchMode) supersede();
    if (!acceptInitial(result)) catalog.error('Could not load station results. Try the country request again.');
    refreshControls();
  };
}
void app.connect().catch(() => {
  // The baseline fixed player stays manually operable in unsupported hosts.
});
