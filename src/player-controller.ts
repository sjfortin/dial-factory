import { PlaybackCoordinator, type CoordinationEnvironment } from './playback-coordinator.js';

type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Selection = { id: string; name: string; streamUrl: string; clickToken?: string };
type Options = { onPlaying?: (token: string) => void; coordination?: CoordinationEnvironment;
  remoteButton?: HTMLButtonElement | null; remoteStatus?: HTMLElement | null };

export function installPlayer(audio: HTMLAudioElement, toggle: HTMLButtonElement, status: HTMLElement, options: Options = {}) {
  let state: PlayerState = 'idle';
  let wanted = false;
  let attempt = 0;
  let selected: Selection | null = null;
  let reportedAttempt = -1;
  let playSettled = false;
  let mediaStarted = false;
  let currentAbort: AbortController | undefined;
  const coordinator = new PlaybackCoordinator(options.coordination);

  function show(next: PlayerState, message: string) {
    state = next;
    status.dataset.state = next;
    status.textContent = message;
    toggle.textContent = wanted ? 'Pause' : 'Play';
    toggle.dataset.action = wanted ? 'pause' : 'play';
    toggle.setAttribute('aria-label', `${wanted ? 'Pause' : 'Play'} ${selected?.name ?? 'live radio'}`);
  }
  function stop() {
    wanted = false;
    attempt++;
    playSettled = false;
    mediaStarted = false;
    currentAbort?.abort();
    currentAbort = undefined;
    audio.pause();
    coordinator.cancel();
  }
  function fail(message: string) { stop(); show('error', message); }
  coordinator.onStop = (reason) => {
    stop();
    show('paused', reason === 'transfer' ? 'Paused because Dial started in another thread.' : 'Paused from another thread.');
  };
  coordinator.onRemote = ({ station, stale, available, outcome }) => {
    if (!options.remoteButton || !options.remoteStatus) return;
    options.remoteButton.hidden = !available || wanted;
    options.remoteButton.disabled = !available;
    options.remoteStatus.textContent = outcome || (!available ? '' : stale
      ? 'Playback in another thread may have changed.' : `Dial may be playing ${station} in another thread.`);
  };

  function started(currentAttempt: number) {
    if (!wanted || currentAttempt !== attempt) return;
    playSettled = true;
    show('playing', `Playing ${selected?.name ?? 'live'}`);
    if (selected?.clickToken && reportedAttempt !== currentAttempt) {
      reportedAttempt = currentAttempt;
      try { options.onPlaying?.(selected.clickToken); } catch { /* reporting never affects playback */ }
    }
  }
  function selectStation(next: Selection) {
    stop();
    audio.removeAttribute('src');
    audio.load();
    selected = next;
    audio.src = next.streamUrl;
    show('idle', `${next.name} selected. Press Play to listen.`);
  }
  function clearSelection() {
    stop();
    audio.removeAttribute('src');
    audio.load();
    selected = null;
    show('idle', 'Select a station to listen.');
  }
  async function play() {
    if (!audio.src) return;
    if (!coordinator.available) { show('error', 'This environment cannot coordinate Dial playback.'); return; }
    wanted = true;
    playSettled = false;
    mediaStarted = false;
    const currentAttempt = ++attempt;
    const abort = new AbortController();
    currentAbort = abort;
    show('buffering', 'Switching playback…');
    const granted = await coordinator.acquire(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, selected?.name ?? 'Radio Paradise', abort.signal);
    if (!granted) {
      if (wanted && currentAttempt === attempt) fail('Could not switch playback; the other thread may still be playing. Try again.');
      return;
    }
    if (!wanted || currentAttempt !== attempt || abort.signal.aborted) { coordinator.release(); return; }
    show('buffering', 'Connecting to live stream…');
    try {
      if (audio.error) audio.load();
      mediaStarted = true;
      await audio.play();
      // An older promise can settle after a newer attempt owns this element.
      if (!wanted || currentAttempt !== attempt) return;
      started(currentAttempt);
    } catch {
      if (wanted && currentAttempt === attempt) fail('Could not start audio. Check your connection or playback permission, then try Play again.');
    }
  }
  toggle.addEventListener('click', () => {
    if (wanted) { stop(); show('paused', `Paused ${selected?.name ?? 'live radio'}`); }
    else void play();
  });
  options.remoteButton?.addEventListener('click', () => { void coordinator.pauseRemote(); });
  audio.addEventListener('playing', () => { if (wanted && playSettled) show('playing', `Playing ${selected?.name ?? 'live'}`); });
  audio.addEventListener('waiting', () => { if (wanted && playSettled) show('buffering', 'Buffering live stream…'); });
  audio.addEventListener('stalled', () => { if (wanted && playSettled) show('buffering', 'Stream stalled; waiting for data…'); });
  audio.addEventListener('pause', () => {
    if (wanted) {
      // While waiting for ownership there is no current media to pause.
      // Queued old-source events also must not stop an active new stream.
      if (!mediaStarted || audio.paused === false) return;
      stop();
      show('paused', `Paused ${selected?.name ?? 'live radio'}`);
    } else if (state !== 'error' && state !== 'idle') show('paused', 'Paused');
  });
  audio.addEventListener('error', () => { if (wanted && audio.error) fail('Stream unavailable or blocked. Try Play again.'); });
  const teardown = () => { stop(); coordinator.dispose(); };
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pagehide', teardown, { once: true });
  return { selectStation, clearSelection, dispose: teardown };
}
