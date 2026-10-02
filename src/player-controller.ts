type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'error';

export function installPlayer(audio: HTMLAudioElement, toggle: HTMLButtonElement, status: HTMLElement) {
  let state: PlayerState = 'idle';
  let wanted = false;
  let attempt = 0;

  function show(next: PlayerState, message: string) {
    state = next;
    status.dataset.state = next;
    status.textContent = message;
    toggle.textContent = wanted ? 'Pause' : 'Play';
    toggle.setAttribute('aria-label', wanted ? 'Pause live radio' : 'Play live radio');
  }

  function fail(message: string) {
    wanted = false;
    attempt++;
    audio.pause();
    show('error', message);
  }

  toggle.addEventListener('click', () => {
    if (wanted) {
      wanted = false;
      attempt++;
      audio.pause();
      show('paused', 'Paused');
      return;
    }

    wanted = true;
    const currentAttempt = ++attempt;
    show('buffering', 'Connecting to live stream…');
    try {
      void audio.play().catch(() => {
        if (wanted && currentAttempt === attempt) {
          fail('Could not start audio. Check your connection or playback permission, then try Play again.');
        }
      });
    } catch {
      if (currentAttempt === attempt) fail('Could not start audio. Try Play again.');
    }
  });

  audio.addEventListener('playing', () => {
    if (wanted) show('playing', 'Playing live');
  });
  audio.addEventListener('waiting', () => {
    if (wanted) show('buffering', 'Buffering live stream…');
  });
  audio.addEventListener('stalled', () => {
    if (wanted) show('buffering', 'Stream stalled; waiting for data…');
  });
  audio.addEventListener('pause', () => {
    if (!wanted && state !== 'error') show('paused', 'Paused');
  });
  audio.addEventListener('error', () => {
    fail('Stream unavailable or blocked. Try Play again.');
  });
}
