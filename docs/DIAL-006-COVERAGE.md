# DIAL-006 coverage evidence

Sample: 2026-11-06 22:57 UTC, `de1.api.radio-browser.info`, exact country code, votes descending, `hidebroken=true`, offsets 0/50/100, 50 rows per request. The candidate's server filter accepted only HTTPS MP3 URLs on the finite origins in `src/media-policy.ts`; counts are catalog choices, not confirmed audible streams. Radio Browser order and stream availability can change. Every request returned 50 rows.

| Country | Accepted by page | Unique URLs across pages | Evidence and limitation |
| --- | ---: | ---: | --- |
| FR | 5 / 1 / 2 | 6 | Meuh and Nova exact provider UUID overrides enter page 1. Their direct HTTPS endpoints returned 200 `audio/mpeg` and MP3 frame bytes. Other BFM entries remain catalog candidates. |
| GB | 6 / 0 / 0 | 6 | Six musicradio.com catalog candidates; no fresh direct stream or host check. |
| US | 0 / 0 / 0 | 0 | BLOCKED. SomaFM `secretagent-128-mp3` had a 200 MP3 result in the 2026-11-06 Spec probe but returned 403 `text/html` on two fresh bounded checks; `groovesalad-128-mp3` also returned 403. `ice5.somafm.com` was omitted from the media policy. |
| CA | 0 / 2 / 1 | 2 | Choice Classic Rock `streamer.radio.co/s66f2626b4/listen` returned 200 `audio/mpeg` and MP3 frame bytes in a fresh bounded probe. The page 3 iRock URL duplicates page 2. |
| DE | 0 / 0 / 1 | 1 | Electro Swing Revolution on the approved radio.co origin entered page 3. Direct response and host playback remain unverified. Earlier sampled SWR URL redirected; it was not admitted. |
| JP | 1 / 0 / 0 | 1 | Súper Tokio Radio on the approved radio.co origin entered page 1. Direct response and host playback remain unverified. Earlier sampled Gensokyo URL redirected; it was not admitted. |
| ES | 0 / 0 / 0 | 0 | BLOCKED. Earlier sampled Los 40 URL redirected; no approved direct candidate was established. |
| IT | 2 / 1 / 2 | 5 | Italia 70 `icy.unitedradio.it/um020.mp3` returned 200 `audio/mpeg` and MP3 frame bytes in a fresh bounded probe. Other entries are catalog candidates. |

Fresh direct probes used HTTPS with redirects disabled, an 8-second timeout, a 0–255 byte range, and a 256-byte output cap. The CA, IT, Meuh and Nova probes each received HTTP 200, `audio/mpeg`, and bytes beginning `ff fb 92`; curl exited 63 after the cap, which indicates it stopped an ongoing response, not a clean 256-byte end. A German/Japanese direct check was interrupted before results were returned and is not evidence. The 2026-11-06 Spec probe found FIP `audio/aac`; its origin and codec remain excluded. The previous Radio Browser sample found 150 rows per country and only FR/GB accepted under the old three-origin policy; the table above is the new candidate filter.

No ChatGPT host playback, narrow/light/dark layout, CSP acceptance, local or remote Pause, more-stations persistence, or audible outcome has been verified. Automated browser simulation covers append while playing, but owner host QA and independent Verify must treat host acceptance as BLOCKED until observed. This document does not claim catalog entries are playable. No hosting, publication, or deployment was performed.
