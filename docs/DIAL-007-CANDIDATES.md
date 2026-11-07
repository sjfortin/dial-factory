# DIAL-007 candidate evidence — 2026-11-06 UTC

This is Spec research, not ChatGPT host playback verification. Between approximately 23:20 and 23:25 UTC, `de1.api.radio-browser.info` returned HTTP 200 `application/json` for 50-row country requests ordered by votes descending with `hidebroken=true`. US, FR, GB, and IT were sampled at offset 0; CA at 0 and 50; DE, JP, and ES at 0, 50, and 100. Each requested page returned 50 rows. Rows can move between requests. The row positions below are zero-based positions within the named page, not durable catalog IDs.

Direct probes used the exact HTTPS URLs below, rejected redirects, requested bytes 0–255, used an 8-second deadline and a 4096-byte cap. These servers ignored the range and returned 200 streaming bodies; curl exited 63 at the cap after receiving 4096 bytes. A 200 `audio/mpeg` response with `ff fb` MP3 frame bytes is evidence of direct stream compatibility at probe time, not audible playback or ChatGPT CSP acceptance. No temporary redirect query token is retained here.

| Country | Provider station and exact UUID | Catalog page / row | Exact tested URL | Direct result |
| --- | --- | ---: | --- | --- |
| FR | Radio Meuh `960a0f41-0601-11e8-ae97-52543be04c81` | 0 / 16 (HTTP provider URL; existing UUID override) | `https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3` | 200 `audio/mpeg`, `ff fb 92 40` |
| GB | Heart 80s `c4077677-dc2f-11e9-a8ba-52543be04c81` | 0 / 0 | `https://media-ssl.musicradio.com/Heart80sMP3` | 200 `audio/mpeg`, `ff fb 92 64` |
| US | 181.FM - The Beat (HipHop/R&B) `9627dcf4-0601-11e8-ae97-52543be04c81` | 0 / 25 | `https://listen.181fm.com/181-beat_128k.mp3` | 200 `audio/mpeg`, `ff fb 92 60` |
| CA | Choice Classic Rock `34ca644e-4aa2-4bf0-b0fe-9122e7f97629` | 1 / 20 | `https://streamer.radio.co/s66f2626b4/listen` | 200 `audio/mpeg`, `ff fb 92 64` |
| DE | Electro Swing Revolution `0e8da368-6917-11e8-b15b-52543be04c81` | 2 / 24 | `https://streamer.radio.co/s2c3cc784b/listen` | 200 `audio/mpeg`, `ff fb b2 44` |
| JP | Súper Tokio Radio `da391117-93a3-4f25-8dc3-c8aa604dde6a` | 0 / 16 | `https://streamer.radio.co/s83eb8ff39/listen` | 200 `audio/mpeg`, `ff fb 92 64` |
| ES | Café del Mar `3fd18c3f-8157-11e9-aa30-52543be04c81` | 0 / 16 | `https://streams.radio.co/se1a320b47/listen` | 200 `audio/mpeg`, `ff fb b2 64` |
| IT | ITALIA Italia 70 `f428a295-760d-11ea-b1cf-52543be04c81` | 0 / 2 | `https://icy.unitedradio.it/um020.mp3` | 200 `audio/mpeg`, `ff fb 92 64` |

All eight cited rows declare country code matching the request and codec `MP3`. FR uses the already reviewed exact UUID override because Radio Browser supplies an HTTP URL; all other cited rows supply the tested HTTPS URL directly. No new override is needed. The two proposed new exact origins are `https://listen.181fm.com` and `https://streams.radio.co`; the other six tested station URLs use existing origins. `https://audio.bfmtv.com` and `https://stream.radioparadise.com` remain in that policy although this table does not use them.

Rejected or unused leads from the same finite pass: SomaFM Groove Salad returned 403; Deutschlandfunk returned 302 and its redirect destination was not admitted; Los 40, SWR, and Gensokyo had previously redirected in DIAL-006. Two additional direct US streams (CNN) and DE (`0n-classicrock.radionetz.de`), and other ES/JP endpoints, were probed but are not proposed because the eight-country set above needs only two new origins. `listen.moe/fallback` and `relay0.r-a-d.io/main.mp3` returned `audio/mpeg` but did not start with an MP3 frame in the capped sample. Do not infer compatibility from their MIME alone. FIP AAC remains excluded; the DIAL-006 evidence for Radio Nova and the existing exact UUID overrides is retained.

No ChatGPT host audio, CSP, layout, More-state, Pause, or click-disclosure check was performed in this research. These remain required for independent Verify and owner acceptance. Catalog presence plus direct bytes must not be labeled complete playable coverage.

## Implementation candidate coverage

The DIAL-007 implementation admits the two new exact source origins, `https://listen.181fm.com` and `https://streams.radio.co`, through the shared finite media policy. The tested US and ES rows qualify through their provider-supplied HTTPS `url_resolved` values. No new UUID override or hardcoded station was added. The other six rows above use existing origins and the existing Radio Meuh override. The table records catalog admission samples and direct MP3 bytes observed on 2026-11-06 UTC. It does not establish that those rows remain in the first three pages, that direct streams still return MP3, or that audio plays inside ChatGPT. Independent Verify must refresh provider/direct evidence and record host playback, CSP, and any redirect gaps before eight-country coverage can pass.
