# DIAL-002 bounded catalog feasibility

Observed 2026-10-04 using Radio Browser's public `https://de1.api.radio-browser.info` mirror. Read-only queries used `/json/stations/bycountrycodeexact/{FR|GB}?order=votes&reverse=true&offset=0&limit=50&hidebroken=true`. The mirror returned 50 records per country. Selection below used matching `countrycode`, `url_resolved` (or `url` when absent), HTTPS, non-HLS, codec MP3, and an exact candidate media origin. This is a catalog snapshot, not a playback or ChatGPT-host observation.

| Country | Station | UUID | Exact origin | Provider codec | Provider URL |
| --- | --- | --- | --- | --- | --- |
| FR | RMC FR | `7a3a3989-8f26-44f7-9ae5-fa91e5cf4f9d` | `https://audio.bfmtv.com` | MP3 | `https://audio.bfmtv.com/rmcradio_128.mp3` |
| FR | BFM radio | `3e6e3252-dd81-4b07-baba-b61bf96cd457` | `https://audio.bfmtv.com` | MP3 | `https://audio.bfmtv.com/bfmradio_128.mp3` |
| GB | Heart 80s | `c4077677-dc2f-11e9-a8ba-52543be04c81` | `https://media-ssl.musicradio.com` | MP3 | `https://media-ssl.musicradio.com/Heart80sMP3` |
| GB | Heart 70s | `e7205cd4-dc30-11e9-a8ba-52543be04c81` | `https://media-ssl.musicradio.com` | MP3 | `https://media-ssl.musicradio.com/Heart70sMP3` |

Within the first 50, the candidate `audio.bfmtv.com` origin appeared on three FR records; `media-ssl.musicradio.com` appeared on six GB records. FR sample HTTPS HEAD requests returned `200` with `audio/mpeg` and no redirect. GB sample HEAD requests returned `405`; that response does not establish GET reachability or failure. No stream data was fetched, no audio was heard, and neither CSP behavior nor compatibility inside ChatGPT was observed. Provider data can change; repeat the query before implementation and perform the separate actual-host verification required by the spec.

Primary references: [Radio Browser API](https://docs.radio-browser.info/) for exact country lookup, `limit`/`hidebroken`/ordering, and click-count guidance; [OpenAI MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui) for tool-linked resources and resource-domain CSP.
