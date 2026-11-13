# DIAL-010 Verify — run-ade7336670ec

- Exact candidate: `67ec8f6f14af468de533884d498126887558ea4c`; HEAD matched. Attempt 2. Approved spec hashes matched (PRODUCT 787490880e3bebba758147156b0525affebbca15e83837311d2ecf6989db751f; TECH 878b72aec6c5b354d30747ce07eb34dda9b3574584ea19c15970467b294220d3).
- Independent Review `run-b90ba03fe77e` ACCEPTed the same candidate.
- `npm test` on 2026-11-13: PASS, 40 tests passed, 0 failed. Coverage includes exact source/CSP policy, one audio/controller/coordinator, Play/Pause/Play-again, error fallback/retry, source switch/stale-event guards, NTS click isolation, and disclosure state.
- Fresh manual redirect-by-redirect direct probes at 2026-11-13T00:50:36.205Z (max five hops, 8s/hop, 30s/channel, Range 0–63, max 64 bytes): NTS 1 and NTS 2 both returned 302 relay → 302 `streams.radiomast.io` → 200 `audio-edge-kkqan.sin.d.radiomast.io`, `audio/mpeg`, 64 bytes with MPEG frame sync. This is one shell/network vantage and time.
- Corrected local Chromium fixture ran with a fresh document and event log per channel. It used CDP mouse clicks, a local HTTP fixture with exact three-origin media CSP, and a real `<audio>` element. Each channel independently showed matching-source `playing`, currentTime advance >100ms, Pause, then new `playing` on Play-again; each had a channel-matching 200 `audio/mpeg` network response. This only establishes local headless browser media events; it does not establish audible output.
- No ChatGPT host session or observer was available. Actual host CSP, audible Play/Pause/Play-again, host error path, and host layout remain BLOCKED. Overall: BLOCKED.
- Structured report: `/tmp/dial010-verify.json`. Raw route and local browser evidence are in this directory.
