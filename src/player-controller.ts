import { PlaybackCoordinator, type CoordinationEnvironment } from './playback-coordinator.js';
import Hls from 'hls.js/light';

type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Selection = { id: string; name: string; streamUrl: string; clickToken?: string; source?: 'nts'; archive?: { showAlias: string; episodeAlias: string; url: string } };
type Options = { onPlaying?: (token: string) => void; coordination?: CoordinationEnvironment;
  remoteButton?: HTMLButtonElement | null; remoteStatus?: HTMLElement | null;
  resolveArchive?: (showAlias: string, episodeAlias: string) => Promise<{ format: 'hls' | 'direct'; url: string; expires?: number } | null>;
  seek?: HTMLInputElement | null; time?: HTMLElement | null };

export function installPlayer(audio: HTMLAudioElement, toggle: HTMLButtonElement, status: HTMLElement, options: Options = {}) {
  let state: PlayerState = 'idle';
  let wanted = false;
  let attempt = 0;
  let selected: Selection | null = null;
  let reportedAttempt = -1;
  let playSettled = false;
  let mediaStarted = false;
  let currentAbort: AbortController | undefined;
  let hls: Hls | undefined;
  let archiveUrl: { format: 'hls' | 'direct'; url: string; expires?: number } | null = null;
  let resumeTime = 0;
  let pausedToken: { id: string; attempt: number } | null = null;
  const mediaSession = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  const mediaRegistration = Symbol('dial-media');
  const mediaGlobal = globalThis as typeof globalThis & { __dialMediaRegistration?: symbol };

  function cleanMedia(keepPaused = false) {
    if (mediaGlobal.__dialMediaRegistration !== mediaRegistration || !mediaSession) return;
    if (keepPaused) { mediaSession.playbackState = 'paused'; return; }
    try { mediaSession.setActionHandler('play', null); mediaSession.setActionHandler('pause', null); } catch { /* unsupported */ }
    mediaSession.metadata = null;
    mediaSession.playbackState = 'none';
    delete mediaGlobal.__dialMediaRegistration;
  }
  function installMedia() {
    if (!mediaSession || !selected) return;
    try {
      mediaGlobal.__dialMediaRegistration = mediaRegistration;
      if (typeof MediaMetadata !== 'undefined') mediaSession.metadata = new MediaMetadata({ title: selected.name, artist: selected.archive ? 'NTS archive' : selected.source === 'nts' ? 'NTS live' : 'Dial radio' });
      mediaSession.playbackState = wanted ? 'playing' : 'paused';
      mediaSession.setActionHandler('pause', () => { if (wanted) pauseLocal(true); });
      mediaSession.setActionHandler('play', () => {
        if (!pausedToken || wanted || pausedToken.id !== selected?.id || pausedToken.attempt !== attempt) return;
        void play(true);
      });
    } catch { cleanMedia(); }
  }
  function clearSource() { hls?.destroy(); hls = undefined; archiveUrl = null; audio.removeAttribute('src'); audio.load(); }
  function updateTime() {
    if (!selected?.archive) { if (options.seek) options.seek.hidden = true; if (options.time) options.time.textContent = ''; return; }
    const duration = audio.duration;
    const seekable = Number.isFinite(duration) && duration > 0 && audio.seekable?.length > 0;
    if (options.seek) { options.seek.hidden = !seekable; options.seek.disabled = !seekable; options.seek.max = String(seekable ? duration : 0); options.seek.value = String(seekable ? Math.min(audio.currentTime || 0, duration) : 0); }
    if (options.time) options.time.textContent = seekable ? `${Math.floor(audio.currentTime / 60)}:${String(Math.floor(audio.currentTime % 60)).padStart(2, '0')} / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : 'Time unavailable';
  }
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
    pausedToken = null;
    audio.pause();
    coordinator.cancel();
    cleanMedia();
  }
  function pauseLocal(eligible: boolean) {
    if (!wanted) return;
    if (selected?.archive && Number.isFinite(audio.currentTime)) resumeTime = audio.currentTime;
    stop();
    if (eligible && selected) { pausedToken = { id: selected.id, attempt }; installMedia(); cleanMedia(true); }
    show('paused', `Paused ${selected?.name ?? 'live radio'}`);
    updateTime();
  }
  function fail(message: string) { stop(); show('error', message); }
  function unavailable(message: string) { return selected?.source === 'nts' ? 'Stream unavailable or blocked. Try Play again, or open on NTS.' : message; }
  coordinator.onStop = (reason) => {
    stop();
    clearSource();
    show('paused', reason === 'transfer' ? 'Paused because Dial started in another thread.' : 'Paused from another thread.');
  };
  coordinator.onRemote = ({ station, stale, available, outcome }) => {
    if (available && pausedToken) { pausedToken = null; cleanMedia(); }
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
    installMedia(); updateTime();
    if (selected?.clickToken && reportedAttempt !== currentAttempt) {
      reportedAttempt = currentAttempt;
      try { options.onPlaying?.(selected.clickToken); } catch { /* reporting never affects playback */ }
    }
  }
  function selectStation(next: Selection) {
    stop();
    clearSource(); resumeTime = 0;
    selected = next;
    if (!next.archive) audio.src = next.streamUrl;
    show('idle', `${next.name} selected. Press Play to listen.`);
    updateTime();
  }
  function clearSelection() {
    stop();
    clearSource(); resumeTime = 0;
    selected = null;
    show('idle', 'Select a station to listen.');
  }
  async function play(external = false) {
    if (!selected && !audio.src) return;
    if (!coordinator.available) { show('error', unavailable('This environment cannot coordinate Dial playback.')); return; }
    const externalToken = external && pausedToken ? { ...pausedToken } : null;
    if (external && (!externalToken || externalToken.id !== selected?.id || externalToken.attempt !== attempt)) return;
    wanted = true;
    playSettled = false;
    mediaStarted = false;
    const currentAttempt = ++attempt;
    const abort = new AbortController();
    currentAbort = abort;
    show('buffering', 'Switching playback…');
    const granted = external ? await coordinator.claimIfIdle(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, selected?.name ?? 'Radio Paradise', abort.signal)
      : await coordinator.acquire(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, selected?.name ?? 'Radio Paradise', abort.signal);
    if (!granted) {
      if (external) {
        wanted = false;
        if (pausedToken && externalToken && pausedToken.id === externalToken.id) pausedToken.attempt = attempt;
        show('paused', 'Media Play could not confirm idle Dial ownership. Press Play in the app.');
        return;
      }
      if (wanted && currentAttempt === attempt) fail(unavailable('Could not switch playback; the other thread may still be playing. Try again.'));
      return;
    }
    if (external && (!pausedToken || pausedToken.id !== externalToken?.id || pausedToken.attempt !== externalToken.attempt || selected?.id !== externalToken.id)) {
      wanted = false; coordinator.release(); show('paused', 'Media Play could not confirm the paused session. Press Play in the app.'); return;
    }
    pausedToken = null;
    if (!wanted || currentAttempt !== attempt || abort.signal.aborted) { coordinator.release(); return; }
    show('buffering', selected?.archive ? 'Resolving NTS archive…' : 'Connecting to live stream…');
    try {
      if (selected?.archive) {
        const { showAlias, episodeAlias } = selected.archive;
        if (!archiveUrl || (archiveUrl.expires !== undefined && archiveUrl.expires * 1000 <= Date.now() + 60000)) {
          hls?.destroy(); hls = undefined;
          const resolved = await options.resolveArchive?.(showAlias, episodeAlias) ?? null;
          if (!wanted || currentAttempt !== attempt || abort.signal.aborted) return;
          archiveUrl = resolved;
        }
        if (!wanted || currentAttempt !== attempt || abort.signal.aborted) return;
        if (!archiveUrl) { fail('Audio unavailable here. Open this episode on NTS.'); return; }
        if (archiveUrl.format === 'hls') {
          if (audio.canPlayType?.('application/vnd.apple.mpegurl')) audio.src = archiveUrl.url;
          else if (Hls.isSupported()) {
            if (!hls) {
              hls = new Hls({ enableWorker: false, xhrSetup: (_xhr: XMLHttpRequest, url: string) => { if (new URL(url).origin !== 'https://playback.media-streaming.soundcloud.cloud') throw new Error('Archive media origin rejected'); } });
              const instance = hls;
              const manifest = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('manifest timeout')), 10000);
                instance.on(Hls.Events.MANIFEST_PARSED, () => { clearTimeout(timeout); resolve(); });
                instance.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { clearTimeout(timeout); reject(new Error('media error')); } });
              });
              instance.loadSource(archiveUrl.url); instance.attachMedia(audio);
              await manifest;
            }
          } else { fail('This host cannot play the archive format. Open on NTS.'); return; }
        } else audio.src = archiveUrl.url;
        if (!wanted || currentAttempt !== attempt || abort.signal.aborted) return;
        if (resumeTime > 0) audio.addEventListener('loadedmetadata', () => { if (selected?.archive && Number.isFinite(audio.duration) && audio.seekable.length) audio.currentTime = Math.min(resumeTime, audio.duration); }, { once: true });
      }
      if (audio.error) audio.load();
      mediaStarted = true;
      await audio.play();
      // An older promise can settle after a newer attempt owns this element.
      if (!wanted || currentAttempt !== attempt) return;
      started(currentAttempt);
    } catch {
      if (wanted && currentAttempt === attempt) fail(unavailable(selected?.archive ? 'Archive audio blocked or unavailable. Press Play to retry, or open on NTS.' : 'Could not start audio. Check your connection or playback permission, then try Play again.'));
    }
  }
  toggle.addEventListener('click', () => {
    if (wanted) pauseLocal(true);
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
      pauseLocal(true);
    } else if (state !== 'error' && state !== 'idle') show('paused', 'Paused');
  });
  audio.addEventListener('error', () => { if (wanted && audio.error) fail(unavailable('Stream unavailable or blocked. Try Play again.')); });
  audio.addEventListener('timeupdate', updateTime);
  audio.addEventListener('durationchange', updateTime);
  audio.addEventListener('ended', () => { if (selected?.archive) { resumeTime = 0; stop(); show('paused', 'Episode ended. Press Play to restart.'); updateTime(); } });
  options.seek?.addEventListener('input', () => { if (!selected?.archive || !Number.isFinite(audio.duration) || !audio.seekable.length) return; const value = Number(options.seek?.value); if (Number.isFinite(value)) audio.currentTime = Math.max(0, Math.min(value, audio.duration)); });
  const teardown = () => { stop(); clearSource(); coordinator.dispose(); };
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pagehide', teardown, { once: true });
  return { selectStation, clearSelection, pauseRemote: () => coordinator.pauseRemote(), remoteAvailable: () => coordinator.available, remoteKnown: () => coordinator.hasRemote(), dispose: teardown };
}
