import { PlaybackCoordinator, type CoordinationEnvironment } from './playback-coordinator.js';
import Hls from 'hls.js/light';

type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Selection = { id: string; name: string; streamUrl: string; clickToken?: string; source?: 'nts'; archive?: { showAlias: string; episodeAlias: string; url: string } };
type Options = { onPlaying?: (token: string) => void; coordination?: CoordinationEnvironment;
  remoteButton?: HTMLButtonElement | null; remoteStatus?: HTMLElement | null;
  resolveArchive?: (showAlias: string, episodeAlias: string) => Promise<{ format: 'hls' | 'direct'; url: string; expires?: number } | null>;
  hlsAdapter?: { isSupported: () => boolean; create: (config: ConstructorParameters<typeof Hls>[0]) => Hls };
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
  let archiveResolvedAt = 0;
  let resumeTime = 0;
  let restorePosition: (() => void) | undefined;
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
  function clearRestore() {
    if (!restorePosition) return;
    for (const event of ['loadedmetadata', 'durationchange', 'canplay']) audio.removeEventListener(event, restorePosition);
    restorePosition = undefined;
  }
  function invalidateArchive() { const old = hls; hls = undefined; old?.destroy(); archiveUrl = null; archiveResolvedAt = 0; }
  function clearSource() { clearRestore(); invalidateArchive(); audio.removeAttribute('src'); audio.load(); }
  function seekRanges(): Array<{ start: number; end: number }> {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0 || !audio.seekable) return [];
    const ranges = [];
    for (let index = 0; index < audio.seekable.length; index++) {
      try {
        const start = Math.max(0, audio.seekable.start(index));
        const end = Math.min(audio.duration, audio.seekable.end(index));
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) ranges.push({ start, end });
      } catch { /* a changing TimeRanges object is temporarily unavailable */ }
    }
    return ranges;
  }
  function nearestSeek(value: number, ranges = seekRanges()): number | null {
    if (!Number.isFinite(value) || !ranges.length) return null;
    let closest = ranges[0].start, distance = Infinity;
    for (const range of ranges) {
      const point = Math.max(range.start, Math.min(value, range.end));
      if (Math.abs(point - value) < distance) { closest = point; distance = Math.abs(point - value); }
    }
    return closest;
  }
  function prepareRestore(currentAttempt: number, sourceId: string) {
    clearRestore();
    if (resumeTime <= 0) return;
    const restore = () => {
      if (!wanted || currentAttempt !== attempt || selected?.id !== sourceId) { clearRestore(); return; }
      if (audio.readyState < 1) return;
      const target = nearestSeek(resumeTime);
      if (target === null) return;
      audio.currentTime = target;
      clearRestore(); updateTime();
    };
    restorePosition = restore;
    for (const event of ['loadedmetadata', 'durationchange', 'canplay']) audio.addEventListener(event, restore);
    restore();
  }
  function updateTime() {
    if (!selected?.archive) { if (options.seek) options.seek.hidden = true; if (options.time) options.time.textContent = ''; return; }
    const duration = audio.duration;
    const ranges = seekRanges();
    const seekable = ranges.length > 0;
    const active = ranges.find(range => audio.currentTime >= range.start && audio.currentTime <= range.end) ?? ranges[0];
    if (options.seek) { options.seek.hidden = !seekable; options.seek.disabled = !seekable; options.seek.min = String(active?.start ?? 0); options.seek.max = String(active?.end ?? 0); options.seek.value = String(seekable ? nearestSeek(audio.currentTime || active.start, [active]) : 0); }
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
    clearRestore();
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
  function fail(message: string) {
    if (selected?.archive && Number.isFinite(audio.currentTime) && audio.currentTime > 0) resumeTime = audio.currentTime;
    stop();
    if (selected?.archive) { clearSource(); updateTime(); }
    show('error', message);
  }
  function unavailable(message: string) { return selected?.source === 'nts' ? 'Stream unavailable or blocked. Try Play again, or open on NTS.' : message; }
  coordinator.onStop = (reason) => {
    if (selected?.archive && Number.isFinite(audio.currentTime) && audio.currentTime > 0) resumeTime = audio.currentTime;
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
    const sourceId = selected?.id;
    const lockEpoch = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const abort = new AbortController();
    currentAbort = abort;
    show('buffering', 'Switching playback…');
    const granted = external ? await coordinator.claimIfIdle(lockEpoch, selected?.name ?? 'Radio Paradise', abort.signal)
      : await coordinator.acquire(lockEpoch, selected?.name ?? 'Radio Paradise', abort.signal);
    if (currentAttempt !== attempt || abort.signal.aborted || selected?.id !== sourceId) {
      if (granted) coordinator.release(lockEpoch);
      return;
    }
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
      wanted = false; coordinator.release(lockEpoch); show('paused', 'Media Play could not confirm the paused session. Press Play in the app.'); return;
    }
    pausedToken = null;
    if (!wanted) { coordinator.release(lockEpoch); return; }
    show('buffering', selected?.archive ? 'Resolving NTS archive…' : 'Connecting to live stream…');
    try {
      if (selected?.archive) {
        const { showAlias, episodeAlias } = selected.archive;
        if (!archiveUrl || Date.now() - archiveResolvedAt >= 5 * 60 * 1000 || (archiveUrl.expires !== undefined && archiveUrl.expires * 1000 <= Date.now() + 60000)) {
          invalidateArchive();
          audio.removeAttribute('src'); audio.load();
          const resolved = await options.resolveArchive?.(showAlias, episodeAlias) ?? null;
          if (!wanted || currentAttempt !== attempt || abort.signal.aborted) return;
          archiveUrl = resolved;
          archiveResolvedAt = resolved ? Date.now() : 0;
        }
        if (!wanted || currentAttempt !== attempt || abort.signal.aborted) return;
        if (!archiveUrl) { fail('Audio unavailable here. Open this episode on NTS.'); return; }
        prepareRestore(currentAttempt, sourceId!);
        if (archiveUrl.format === 'hls') {
          if (audio.canPlayType?.('application/vnd.apple.mpegurl')) audio.src = archiveUrl.url;
          else if ((options.hlsAdapter?.isSupported ?? Hls.isSupported)()) {
            if (!hls) {
              const config = { enableWorker: false, xhrSetup: (_xhr: XMLHttpRequest, url: string) => { if (new URL(url).origin !== 'https://playback.media-streaming.soundcloud.cloud') throw new Error('Archive media origin rejected'); } };
              hls = options.hlsAdapter?.create(config) ?? new Hls(config);
              const instance = hls;
              const manifest = new Promise<void>((resolve, reject) => {
                let pending = true;
                const timeout = setTimeout(() => { if (pending) { pending = false; reject(new Error('manifest timeout')); } }, 10000);
                instance.on(Hls.Events.MANIFEST_PARSED, () => { if (pending) { pending = false; clearTimeout(timeout); resolve(); } });
                instance.on(Hls.Events.ERROR, (_event, data) => {
                  if (!data.fatal || hls !== instance || currentAttempt !== attempt || selected?.id !== sourceId) return;
                  if (pending) { pending = false; clearTimeout(timeout); reject(new Error('media error')); }
                  fail('Archive audio failed. Press Play to retry with a fresh source, or open on NTS.');
                });
                abort.signal.addEventListener('abort', () => { if (pending) { pending = false; clearTimeout(timeout); reject(new Error('canceled')); } }, { once: true });
              });
              instance.loadSource(archiveUrl.url); instance.attachMedia(audio);
              await manifest;
            }
          } else { fail('This host cannot play the archive format. Open on NTS.'); return; }
        } else audio.src = archiveUrl.url;
        if (!wanted || currentAttempt !== attempt || abort.signal.aborted) return;
        restorePosition?.();
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
  options.seek?.addEventListener('input', () => { if (!selected?.archive) return; const target = nearestSeek(Number(options.seek?.value)); if (target !== null) { audio.currentTime = target; updateTime(); } });
  const teardown = () => { stop(); clearSource(); coordinator.dispose(); };
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('pagehide', teardown, { once: true });
  return { selectStation, clearSelection, pauseRemote: () => coordinator.pauseRemote(), remoteAvailable: () => coordinator.available, remoteKnown: () => coordinator.hasRemote(), dispose: teardown };
}
