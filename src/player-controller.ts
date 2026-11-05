type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';
export type Selection = { id: string; name: string; streamUrl: string; clickToken?: string };

export function installPlayer(audio: HTMLAudioElement, toggle: HTMLButtonElement, status: HTMLElement, options: { onPlaying?: (token: string) => void } = {}) {
  let state: PlayerState = 'idle';
  let wanted = false;
  let attempt = 0;
  let selected: Selection | null = null;
  let reportedAttempt = -1;
  let playSettled = false;

  function show(next: PlayerState, message: string) {
    state = next;
    status.dataset.state = next;
    status.textContent = message;
    toggle.textContent = wanted ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', `${wanted ? 'Pause' : 'Play'} ${selected?.name ?? 'live radio'}`);
  }

  function fail(message: string) {
    wanted = false;
    attempt++;
    audio.pause();
    show('error', message);
  }

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
    attempt++;
    wanted = false;
    playSettled = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    selected = next;
    audio.src = next.streamUrl;
    show('idle', `${next.name} selected. Press Play to listen.`);
  }

  function clearSelection() {
    attempt++;
    wanted = false;
    playSettled = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    selected = null;
    show('idle', 'Select a station to listen.');
  }

  toggle.addEventListener('click', () => {
    if (wanted) {
      wanted = false;
      attempt++;
      audio.pause();
      show('paused', `Paused ${selected?.name ?? 'live radio'}`);
      return;
    }
    if (!audio.src) return;
    wanted = true;
    playSettled = false;
    const currentAttempt = ++attempt;
    show('buffering', 'Connecting to live stream…');
    try {
      if (audio.error) audio.load();
      void audio.play().then(() => started(currentAttempt), () => {
        if (wanted && currentAttempt === attempt) fail('Could not start audio. Check your connection or playback permission, then try Play again.');
      });
    } catch {
      if (currentAttempt === attempt) fail('Could not start audio. Try Play again.');
    }
  });

  audio.addEventListener('playing', () => {
    // The matching play promise supplies an attempt identity. A queued event
    // from an old source must not make a newly selected station look active.
    if (wanted && playSettled) show('playing', `Playing ${selected?.name ?? 'live'}`);
  });
  audio.addEventListener('waiting', () => { if (wanted && playSettled) show('buffering', 'Buffering live stream…'); });
  audio.addEventListener('stalled', () => { if (wanted && playSettled) show('buffering', 'Stream stalled; waiting for data…'); });
  audio.addEventListener('pause', () => { if (!wanted && state !== 'error' && state !== 'idle') show('paused', 'Paused'); });
  audio.addEventListener('error', () => { if (wanted && audio.error) fail('Stream unavailable or blocked. Try Play again.'); });

  return { selectStation, clearSelection };
}
