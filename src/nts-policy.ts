// The two published NTS direct-player URLs are the only NTS media sources.
export const NTS_CHANNELS = {
  '1': { id: 'nts-1', name: 'NTS 1', streamUrl: 'https://stream-relay-geo.ntslive.net/stream?client=direct' },
  '2': { id: 'nts-2', name: 'NTS 2', streamUrl: 'https://stream-relay-geo.ntslive.net/stream2?client=direct' }
} as const;

// Observed redirect route on 2026-11-12; a new edge requires new evidence.
export const NTS_RESOURCE_ORIGINS = [
  'https://stream-relay-geo.ntslive.net',
  'https://streams.radiomast.io',
  'https://audio-edge-kkqan.sin.d.radiomast.io'
] as const;
