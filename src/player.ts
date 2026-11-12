import { App } from '@modelcontextprotocol/ext-apps';
import { installPlayer } from './player-controller.js';
import { createStationCatalog } from './station-list.js';

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
  const catalog = createStationCatalog(list, summary, toggle, (row) => {
    player.selectStation(row);
    if (stationTitle) stationTitle.textContent = row.name;
    if (stationSubtitle) stationSubtitle.textContent = [row.countryCode, row.codec, typeof row.bitrate === 'number' ? `${row.bitrate} kbps` : null].filter(Boolean).join(' · ');
  });
  let pending: { generation: number; countryCode: string } | null = null;
  const refreshControls = () => {
    if (more) more.hidden = !catalog.canMore;
    if (retry) { retry.hidden = !catalog.canRetry; retry.disabled = pending !== null; }
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
    const result = params.structuredContent as { kind?: string };
    // Retry notifications have no request identity. Only the matching promise may merge them.
    if (result.kind === 'retry') return;
    if (result.kind !== 'initial') return;
    pending = null;
    if (catalog.receive(result) === 'initial') {
      player.clearSelection();
      if (stationTitle) stationTitle.textContent = 'Choose a station';
      if (stationSubtitle) stationSubtitle.textContent = 'Select from the stations below';
    } else catalog.error('Could not load station results. Try the country request again.');
    refreshControls();
  };
}
void app.connect().catch(() => {
  // The baseline fixed player stays manually operable in unsupported hosts.
});
