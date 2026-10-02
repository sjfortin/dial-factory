import { App } from '@modelcontextprotocol/ext-apps';
import { installPlayer } from './player-controller.js';

installPlayer(
  document.querySelector<HTMLAudioElement>('#radio')!,
  document.querySelector<HTMLButtonElement>('#toggle')!,
  document.querySelector<HTMLElement>('#status')!
);

// Establish the standard MCP Apps ui/initialize bridge. This player has no
// host tool data to consume; station and stream are fixed in this proof.
const app = new App({ name: 'dial-radio-player', version: '0.1.0' });
void app.connect().catch(() => {
  // Playback remains user controlled if an unsupported host omits the bridge.
});
