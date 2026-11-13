import { App } from '@modelcontextprotocol/ext-apps';
import { installPlayer } from './player-controller.js';
import { createStationCatalog } from './station-list.js';
import { NTS_CHANNELS } from './nts-policy.js';

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
const countrySelect = document.querySelector<HTMLSelectElement>('#country-select');
const countriesTab = document.querySelector<HTMLButtonElement>('#countries-tab');
const ntsTab = document.querySelector<HTMLButtonElement>('#nts-tab');
const countriesPanel = document.querySelector<HTMLElement>('#countries-panel');
const ntsPanel = document.querySelector<HTMLElement>('#nts-panel');
const countryAttribution = document.querySelector<HTMLElement>('#country-attribution');
const player = installPlayer(audio, toggle, status, {
  coordination: {
    locks: navigator.locks,
    channel: (name) => new BroadcastChannel(name)
  },
  remoteButton, remoteStatus,
  onPlaying: (clickToken) => {
    void app.callServerTool({ name: 'report_station_click', arguments: { clickToken } }).catch(() => {});
  }
});
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
  };
  countriesTab?.addEventListener('click', () => showCollection('countries'));
  ntsTab?.addEventListener('click', () => showCollection('nts'));
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
    if (stationTitle) stationTitle.textContent = selection.name;
    if (stationSubtitle) stationSubtitle.textContent = 'NTS · live channel · experimental playback';
    if (countryAttribution) countryAttribution.hidden = true;
    for (const option of ntsPanel.querySelectorAll<HTMLButtonElement>('.nts-option')) option.setAttribute('aria-pressed', String(option === button));
  }));
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
    const result = params.structuredContent as { kind?: string; requestId?: string };
    // Retry notifications have no request identity. Only the matching promise may merge them.
    if (result.kind === 'retry') return;
    // Picker calls carry an echoed ID. Their correlated promise alone may apply them;
    // late or duplicate notifications must never replace a newer selection.
    if (result.kind !== 'initial' || typeof result.requestId === 'string') return;
    // A fresh chat request supersedes any in-flight picker request.
    activeCountryRequest = null;
    pending = null;
    if (!acceptInitial(result)) catalog.error('Could not load station results. Try the country request again.');
    refreshControls();
  };
}
void app.connect().catch(() => {
  // The baseline fixed player stays manually operable in unsupported hosts.
});
