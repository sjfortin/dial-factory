# DIAL-007 — finite media-policy revision and verification

## Approval and baseline

Foreman must bind human approval to the exact SHA-256 content of this file and PRODUCT.md before Implement starts. Base the change on reviewed DIAL-006 candidate `164ed275bf510869410c1df8fcf42a460510e5e6` (an ancestor of the current branch), preserving its pagination and stale-response fixes. The 2026-11-06 direct probes in `docs/DIAL-007-CANDIDATES.md` justify a concrete implementation candidate; they do not establish ChatGPT host audibility or CSP acceptance. Host checks remain a Verify gate.

## Architecture, components and data

- Keep the existing `find_stations_by_country` and bounded continuation tool. Inputs remain an assigned ISO alpha-2 country and, only for continuation, page index 1 or 2. Use the existing Radio Browser HTTPS origin, reject provider redirects, 5-second provider timeout, 512 KB response cap, 50-row scan, at most ten returned choices per page, sanitized fields and server-signed provider UUID click tokens. No input URL, host, arbitrary offset or page size is added.
- Change `src/media-policy.ts` to add only the two exact origins listed below. `src/discovery.ts` continues to admit exact-country Radio Browser `MP3` rows with a valid UUID and a validated direct HTTPS media URL on this list. The proposed US and ES rows already contain the tested HTTPS URL in `url_resolved`; add **no** UUID override for them. Keep the four existing exact Meuh/Nova UUID overrides unchanged, retaining their Radio Browser UUIDs for click attribution. Never auto-upgrade arbitrary HTTP rows.
- Keep `src/station-list.ts` browser URL validation and `src/server.ts` CSP `resourceDomains` derived from the same media-origin list. Keep `connectDomains: []` and the fixed-player Radio Paradise-only CSP. Increment the country UI resource URI when its delivered browser bundle/policy changes, and update the exact URI regression. Confirm the server, browser and CSP lists match.
- Do not alter `src/player.ts` generation/request guards, catalog append/reset rules, `src/player-controller.ts`, or `src/playback-coordinator.ts` merely to add origins. Later-page results must retain selected/playing state. Existing click reporting remains best effort after the playing threshold and bound to a short-lived signed provider UUID token.

## Exact finite media policy

The full permitted origins after this revision are:

1. `https://stream.radioparadise.com` — existing
2. `https://audio.bfmtv.com` — existing
3. `https://media-ssl.musicradio.com` — existing; tested GB Heart 80s
4. `https://streamer.radio.co` — existing; tested CA Choice Classic Rock, DE Electro Swing Revolution, JP Súper Tokio Radio
5. `https://icy.unitedradio.it` — existing; tested IT Italia 70
6. `https://radiomeuh.ice.infomaniak.ch` — existing; tested FR Radio Meuh via existing exact override
7. `https://novazz.ice.infomaniak.ch` — existing; retain DIAL-006 exact Nova overrides
8. `https://listen.181fm.com` — **new**; tested US 181.FM The Beat, UUID `9627dcf4-0601-11e8-ae97-52543be04c81`, `https://listen.181fm.com/181-beat_128k.mp3`
9. `https://streams.radio.co` — **new**; tested ES Café del Mar, UUID `3fd18c3f-8157-11e9-aa30-52543be04c81`, `https://streams.radio.co/se1a320b47/listen`

The eight exact tested station UUIDs, names, URLs, page positions, status, MIME and MP3 byte prefixes are in `docs/DIAL-007-CANDIDATES.md`. They are examples of admitted provider rows under the finite origin filter, not hardcoded synthetic stations. Exact tested URLs for the two new origins are the implementation acceptance samples; no other host is approved by this revision. Keep source URL checks for `https:`, no credentials, no explicit port, no fragment, no playlist extension, and exact origin membership. Provider requests and direct qualification probes reject redirects; there is no server-side media fetch, stream relay or proxy. Native `HTMLAudioElement` may follow a runtime redirect, subject to host CSP; source URL validation alone cannot prove its destination. Verify actual host behavior and record any unapproved destination or playback gap. Direct stream probes returning 3xx, non-`audio/mpeg`, or no plausible MP3 beginning are insufficient to add an origin. The direct checks found 200 `audio/mpeg` with `ff fb` frame bytes for all eight sample URLs at probe time; live availability can change. No wildcard or arbitrary provider origin is approved.

The alternative DE `0n-classicrock.radionetz.de` and US CNN endpoints also produced direct MP3 bytes but are excluded because existing `streamer.radio.co` and the chosen `listen.181fm.com` cover those countries. SomaFM returned 403, Deutschlandfunk redirected, and the old SWR/Gensokyo/Los 40 URLs redirected. FIP AAC and any redirect destination remain outside this policy. A redirect destination may be investigated separately, but must receive its own bounded direct probe and new exact spec approval before admission.

## Tests and independent verification

- Extend discovery tests with valid exact US/ES provider rows and rejection of same-name rows on unlisted origins, wrong-country/codec/UUID, malformed URL, explicit port, playlist and redirecting provider response. Check that no new override exists and the existing Meuh/Nova UUID override and signed click attribution still work. Test page 0/1/2 bounds, 50-row scan and ten-return cap.
- Extend server and delivered-browser regressions for the exact nine-origin equality across discovery, browser validation and CSP, empty `connectDomains`, changed country UI URI and fixed-player CSP. Preserve DIAL-006 overlapping-page, duplicate URL/UUID, empty/short/error/retry, 30-choice, stale same-country/cross-country, selection and playback continuity, keyboard and safe-text coverage. Run build/typecheck and the repository test suite, recording actual results.
- Independent Verify repeats dated provider-row and redirect-rejecting bounded direct checks for the two new origins and representative existing-country streams. Record status, MIME and first bytes without storing transient redirect tokens. Verify candidate code against the exact approved spec and commit. Catalog admission and direct bytes are separate from audible host playback.
- Owner ChatGPT host QA supplies actual evidence for representative playback across all eight countries, CSP acceptance and any native audio redirect destination, ordinary/narrow light/dark Studio layout, selection and audio continuity while More succeeds/fails/retries, local and remote Pause, and click disclosure. Independent Verify marks each required criterion PASS/FAIL/BLOCKED with evidence; missing host or audible evidence remains BLOCKED. Review and Verify identities must differ from Implement and bind to the final candidate commit. No hosting step starts from this Spec alone.

## Failure and rollback

Provider or stream failure uses existing bounded error and retry behavior; a failed later page leaves loaded rows and audio untouched. If a new origin redirects, ceases to return MP3, fails CSP, or is inaudible in the host, record the country gap and do not claim eight-country acceptance. Correct a fixable defect through Implement, fresh Review and Verify; obtain a new exact spec approval before admitting a different origin or UUID override. Revert the added origins and URI/bundle change to the reviewed DIAL-006 behavior if the candidate regresses pagination or playback. No merge, publication, deployment or hosting occurs here.
