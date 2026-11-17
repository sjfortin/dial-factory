const KEY = 'dial-pause-requests-v1';
const LIMIT = 32;
const idPattern = /^[a-zA-Z0-9-]{1,100}$/;
export type PauseRequestStore = Pick<Storage, 'getItem' | 'setItem'>;
export function rememberPauseRequest(store: PauseRequestStore | undefined, requestId: string): 'new' | 'seen' | 'unavailable' {
  if (!store || !idPattern.test(requestId)) return 'unavailable';
  try {
    const parsed: unknown = JSON.parse(store.getItem(KEY) ?? '[]');
    const prior = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && idPattern.test(value)).slice(-LIMIT) : [];
    if (prior.includes(requestId)) return 'seen';
    store.setItem(KEY, JSON.stringify([...prior.slice(-(LIMIT - 1)), requestId]));
    return 'new';
  } catch { return 'unavailable'; }
}
