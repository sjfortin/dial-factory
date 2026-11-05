import { App } from '@modelcontextprotocol/ext-apps';
import { installPlayer } from './player-controller.js';
import { renderStations } from './station-list.js';

const audio = document.querySelector<HTMLAudioElement>('#radio')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const status = document.querySelector<HTMLElement>('#status')!;
const app = new App({ name: 'dial-radio-player', version: '0.2.0' });
const list = document.querySelector<HTMLElement>('#stations');
const summary = document.querySelector<HTMLElement>('#summary');
const player = installPlayer(audio, toggle, status, {
  onPlaying: (clickToken) => {
    void app.callServerTool({ name: 'report_station_click', arguments: { clickToken } }).catch(() => {});
  }
});
if (list && summary) {
  app.ontoolresult = (params) => {
    if (!params.structuredContent || typeof params.structuredContent !== 'object' || !('status' in params.structuredContent)) return;
    player.clearSelection();
    renderStations(params.structuredContent, list, summary, toggle, (row) => player.selectStation(row));
  };
}
void app.connect().catch(() => {
  // The baseline fixed player stays manually operable in unsupported hosts.
});
