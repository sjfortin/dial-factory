export const LOCK_NAME = 'dial-playback-v1';
export const CHANNEL_NAME = 'dial-playback-channel-v1';
const VERSION = 1;
const WAIT_MS = 4500;
const PAUSE_MS = 1800;
const STATUS_MS = 5000;

type Message = {
  v: number; type: 'status' | 'status_request' | 'transfer' | 'pause' | 'ack';
  sender: string; request?: string; target?: string; epoch?: string;
  station?: string; active?: boolean;
};
type Channel = { postMessage(message: Message): void; close(): void; onmessage: ((event: any) => void) | null };
type Locks = { request(name: string, options: { mode: 'exclusive'; signal: AbortSignal }, callback: () => Promise<void>): Promise<unknown> };
export type CoordinationEnvironment = {
  locks?: Locks; channel?: (name: string) => Channel; id?: () => string;
  now?: () => number; setTimeout?: typeof setTimeout; clearTimeout?: typeof clearTimeout;
  setInterval?: typeof setInterval; clearInterval?: typeof clearInterval;
};
export type RemoteState = { station: string; stale: boolean; available: boolean; outcome: string };

function randomId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function valid(m: unknown): m is Message {
  if (!m || typeof m !== 'object') return false;
  const x = m as Record<string, unknown>;
  return x.v === VERSION && typeof x.sender === 'string' && x.sender.length > 0 && x.sender.length < 100 &&
    ['status', 'status_request', 'transfer', 'pause', 'ack'].includes(String(x.type)) &&
    (x.request === undefined || (typeof x.request === 'string' && x.request.length < 100)) &&
    (x.target === undefined || (typeof x.target === 'string' && x.target.length < 100)) &&
    (x.epoch === undefined || (typeof x.epoch === 'string' && x.epoch.length < 100)) &&
    (x.station === undefined || (typeof x.station === 'string' && x.station.length <= 100)) &&
    (x.active === undefined || typeof x.active === 'boolean');
}

export class PlaybackCoordinator {
  readonly available: boolean;
  private readonly id: string;
  private readonly channel?: Channel;
  private readonly locks?: Locks;
  private readonly now: () => number;
  private readonly timer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;
  private readonly interval: typeof setInterval;
  private readonly clearIntervalTimer: typeof clearInterval;
  private held?: { epoch: string; release: () => void; station: string };
  private waiting?: { epoch: string; abort: AbortController; finish: (granted: boolean) => void; timeout: ReturnType<typeof setTimeout>; poll: ReturnType<typeof setInterval> };
  private remote?: { id: string; epoch: string; station: string; at: number };
  private pendingPause?: { request: string; id: string; epoch: string; finish: (confirmed: boolean) => void; timeout: ReturnType<typeof setTimeout> };
  private heartbeat?: ReturnType<typeof setInterval>;
  private staleTicker?: ReturnType<typeof setInterval>;
  private disposed = false;
  onStop: (reason: 'transfer' | 'remote') => void = () => {};
  onRemote: (state: RemoteState) => void = () => {};

  constructor(env: CoordinationEnvironment = {}) {
    this.id = env.id?.() ?? randomId();
    this.now = env.now ?? Date.now;
    this.timer = env.setTimeout ?? setTimeout;
    this.clearTimer = env.clearTimeout ?? clearTimeout;
    this.interval = env.setInterval ?? setInterval;
    this.clearIntervalTimer = env.clearInterval ?? clearInterval;
    this.locks = env.locks;
    try { if (this.locks && env.channel) this.channel = env.channel(CHANNEL_NAME); } catch { /* fail closed */ }
    this.available = !!(this.locks && this.channel && typeof this.locks.request === 'function');
    if (this.channel) {
      this.channel.onmessage = (e) => this.receive(e.data);
      this.send({ type: 'status_request' });
      this.staleTicker = this.interval(() => this.publishRemote(), 1000);
    }
  }

  private send(part: Omit<Message, 'v' | 'sender'>) {
    try { this.channel?.postMessage({ v: VERSION, sender: this.id, ...part }); } catch { /* lock still guards playback */ }
  }
  private publishRemote(outcome = '') {
    this.onRemote({ station: this.remote?.station ?? '', stale: !this.remote || this.now() - this.remote.at > STATUS_MS,
      available: this.available && !!this.remote, outcome });
  }
  private status() {
    if (this.held) this.send({ type: 'status', active: true, epoch: this.held.epoch, station: this.held.station.slice(0, 100) });
  }
  private askTransfer() {
    this.send({ type: 'status_request' });
    if (this.waiting && this.remote) this.send({ type: 'transfer', request: this.waiting.epoch, target: this.remote.id, epoch: this.remote.epoch });
  }
  private receive(raw: unknown) {
    if (this.disposed || !valid(raw) || raw.sender === this.id) return;
    const m = raw;
    if (m.type === 'status_request') { this.status(); return; }
    if (m.type === 'status') {
      if (m.active && m.epoch) {
        this.remote = { id: m.sender, epoch: m.epoch, station: m.station ?? 'Dial radio', at: this.now() };
        this.publishRemote();
        if (this.waiting) this.send({ type: 'transfer', request: this.waiting.epoch, target: this.remote.id, epoch: this.remote.epoch });
      } else if (this.remote?.id === m.sender && this.remote.epoch === m.epoch) {
        this.remote = undefined;
        this.publishRemote();
      }
      return;
    }
    if ((m.type === 'transfer' || m.type === 'pause') && this.held && m.target === this.id && m.epoch === this.held.epoch && m.request) {
      const oldEpoch = this.held.epoch;
      this.onStop(m.type === 'transfer' ? 'transfer' : 'remote'); // audio.pause() is synchronous
      this.release();
      this.send({ type: 'ack', request: m.request, target: m.sender, epoch: oldEpoch });
      return;
    }
    if (m.type === 'ack' && this.pendingPause && m.target === this.id && m.request === this.pendingPause.request &&
      m.sender === this.pendingPause.id && m.epoch === this.pendingPause.epoch) {
      const p = this.pendingPause;
      this.pendingPause = undefined;
      this.clearTimer(p.timeout);
      this.remote = undefined;
      this.publishRemote('Paused in another thread.');
      p.finish(true);
    }
  }

  async acquire(epoch: string, station: string, signal: AbortSignal): Promise<boolean> {
    if (!this.available || this.disposed || signal.aborted || this.waiting || this.held) return false;
    const abort = new AbortController();
    let settled = false;
    return new Promise<boolean>((resolve) => {
      const finish = (granted: boolean) => { if (!settled) { settled = true; resolve(granted); } };
      const timeout = this.timer(() => { abort.abort(); finish(false); this.clearWaiting(epoch); }, WAIT_MS);
      const poll = this.interval(() => this.askTransfer(), 350);
      this.waiting = { epoch, abort, finish, timeout, poll };
      signal.addEventListener('abort', () => { abort.abort(); finish(false); this.clearWaiting(epoch); }, { once: true });
      this.askTransfer();
      void Promise.resolve().then(() => this.locks!.request(LOCK_NAME, { mode: 'exclusive', signal: abort.signal }, async () => {
        if (settled || signal.aborted || this.disposed || this.waiting?.epoch !== epoch) return;
        this.clearWaiting(epoch);
        let release!: () => void;
        const held = new Promise<void>((done) => { release = done; });
        this.held = { epoch, station, release };
        this.remote = undefined;
        this.publishRemote();
        this.status();
        this.heartbeat = this.interval(() => this.status(), 2000);
        finish(true);
        await held;
      })).catch(() => { finish(false); this.clearWaiting(epoch); });
    });
  }

  release() {
    if (!this.held) return;
    const held = this.held;
    this.held = undefined;
    if (this.heartbeat) this.clearIntervalTimer(this.heartbeat);
    this.send({ type: 'status', active: false, epoch: held.epoch });
    held.release();
  }
  cancel() {
    if (this.waiting) {
      const w = this.waiting;
      w.abort.abort(); w.finish(false); this.clearWaiting(w.epoch);
    }
    this.release();
  }
  private clearWaiting(epoch: string) {
    if (this.waiting?.epoch !== epoch) return;
    this.clearTimer(this.waiting.timeout);
    this.clearIntervalTimer(this.waiting.poll);
    this.waiting = undefined;
  }
  pauseRemote(): Promise<boolean> {
    if (!this.available || !this.remote || this.disposed) {
      this.publishRemote('Could not confirm Pause; check the other thread.');
      return Promise.resolve(false);
    }
    if (this.pendingPause) return Promise.resolve(false);
    const { id, epoch } = this.remote;
    const request = randomId();
    return new Promise<boolean>((finish) => {
      const timeout = this.timer(() => {
        if (this.pendingPause?.request !== request) return;
        this.pendingPause = undefined;
        this.publishRemote('Could not confirm Pause; check the other thread.');
        finish(false);
      }, PAUSE_MS);
      this.pendingPause = { id, epoch, request, finish, timeout };
      this.send({ type: 'pause', target: id, epoch, request });
    });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    if (this.staleTicker) this.clearIntervalTimer(this.staleTicker);
    if (this.pendingPause) { this.clearTimer(this.pendingPause.timeout); this.pendingPause.finish(false); this.pendingPause = undefined; }
    this.channel?.close();
  }
}
