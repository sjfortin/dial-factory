import { App } from '@modelcontextprotocol/ext-apps';
import { installPlayer } from './player-controller.js';
import { renderStations } from './station-list.js';

const audio = document.querySelector<HTMLAudioElement>('#radio')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
const remoteButton = document.querySelector<HTMLButtonElement>('#remote-pause');
const remoteStatus = document.querySelector<HTMLElement>('#remote-status');
const app = new App({ name: 'dial-radio-player', version: '0.2.0' });
const list = document.querySelector<HTMLElement>('#stations');
const summary = document.querySelector<HTMLElement>('#summary');
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
  app.ontoolresult = (params) => {
    if (!params.structuredContent || typeof params.structuredContent !== 'object' || !('status' in params.structuredContent)) return;
    player.clearSelection();
    if (stationTitle) stationTitle.textContent = 'Choose a station';
    if (stationSubtitle) stationSubtitle.textContent = 'Select from the stations below';
    renderStations(params.structuredContent, list, summary, toggle, (row) => {
      player.selectStation(row);
      if (stationTitle) stationTitle.textContent = row.name;
      if (stationSubtitle) stationSubtitle.textContent = [row.countryCode, row.codec, typeof row.bitrate === 'number' ? `${row.bitrate} kbps` : null].filter(Boolean).join(' · ');
    });
  };
}
void app.connect().catch(() => {
  // The baseline fixed player stays manually operable in unsupported hosts.
});
