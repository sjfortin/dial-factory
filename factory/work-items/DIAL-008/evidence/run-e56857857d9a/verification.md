# DIAL-008 Verify evidence — run-e56857857d9a

- Candidate: `0387065c993159b349311580fe801c92719171cb` (also `HEAD` during verification).
- Attempt: 2. Latest independent Review `run-e5be268b1f40` accepted this exact commit.
- `npm test`: PASS; build succeeded, 35 passed, 0 failed.
- Focused `node --test test/discovery.test.js test/station-list.test.js`: PASS; 17 passed, 0 failed.
- Fresh live catalog scans used built `dist/discovery.js` with Node `--dns-result-order=ipv4first --no-network-family-autoselection`, on 2026-11-12. All 3 bounded windows succeeded in each country: US 10, FR 4, JP 1, GB 5, CA 2, DE 0, ES 0, IT 7.
- Separate US pagination scan at 2026-11-12T03:44:39Z found 10 compatible choices first appearing at offsets 0/50/100 as 1/6/3. This verifies actual later-window compatible catalog choices within the three-window scan.
- Catalog admission does not establish direct MP3 reachability or audible ChatGPT playback. No direct MP3 probes or owner-host ChatGPT UI/audio/CSP checks were performed. Host playback/CSP, More/retry audible continuity, Pause/resume, layout, and click disclosure remain BLOCKED.
- Full structured report: `/tmp/dial008-verify.json`.
