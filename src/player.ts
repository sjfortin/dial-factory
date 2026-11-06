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
  let pending = false;
  const refreshMore = () => { if (more) { more.hidden = catalog.nextPage === null; more.disabled = pending; } };
  more?.addEventListener('click', () => {
    const pageIndex = catalog.nextPage;
    if (pending || pageIndex === null) return;
    const countryCode = catalog.country;
    pending = true;
    refreshMore();
    void app.callServerTool({ name: 'more_stations_by_country', arguments: { countryCode, pageIndex } })
      .then(result => { if (result.structuredContent) catalog.receive(result.structuredContent); })
      .catch(() => { catalog.receive({ kind: 'continuation', pageIndex, countryCode, status: 'provider_unavailable', searchedCount: 0, limit: 50, stations: [] }); })
      .finally(() => { pending = false; refreshMore(); });
  });
  app.ontoolresult = (params) => {
    if (!params.structuredContent || typeof params.structuredContent !== 'object' || !('status' in params.structuredContent)) return;
    const result = params.structuredContent as { kind?: string };
    if (result.kind !== 'continuation') {
      player.clearSelection();
      if (stationTitle) stationTitle.textContent = 'Choose a station';
      if (stationSubtitle) stationSubtitle.textContent = 'Select from the stations below';
    }
    catalog.receive(result);
    refreshMore();
  };
}
void app.connect().catch(() => {
  // The baseline fixed player stays manually operable in unsupported hosts.
});
