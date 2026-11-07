# DIAL-007 — complete eight-country station candidate coverage

## Problem and decision

DIAL-006 produced a reviewed pagination and playback-continuity candidate at commit `164ed275bf510869410c1df8fcf42a460510e5e6`, but Review could not accept its approved coverage requirement: US had no accepted station, ES had none, DE/JP lacked direct stream checks, and ChatGPT host QA was absent. The owner chose to pursue expanded finite candidates for the original FR, GB, US, CA, DE, JP, ES, IT objective. This exact revised PRODUCT/TECH pair needs owner approval before Implement edits production code. Hosting follows owner acceptance of coverage and is outside this work.

## Behavior and UX

- Keep the DIAL-006 country request, up to ten compatible choices per 50-row page, at most two **More stations** presses, three pages and 30 displayed choices. Append in provider order and suppress duplicate UUIDs and identical canonical stream URLs across pages. Show the inspected range and whether another page remains. Catalog order can shift; this is a bounded scan, not a complete or stable directory.
- Keep the reviewed generation and request-identity guards for stale same-country and cross-country responses. A continuation, empty page, failure, or retry preserves current selection and audio. A genuinely new country request resets them. **More stations** never starts audio.
- Keep the compact neutral Studio player, readable narrow/light/dark layout, keyboard focus, status text, Radio Browser attribution, separate selection and Play, same-browser playback coordination, truthful remote status, and best-effort click reporting after user-initiated playback starts.
- Make at least one direct HTTPS MP3 catalog candidate available for each of FR, GB, US, CA, DE, JP, ES, IT within the exact finite policy in TECH.md. The dated Spec sample in `docs/DIAL-007-CANDIDATES.md` identifies one candidate per country. These are candidate streams, not a promise of audible playback. A station whose source later fails must show the existing clean playback error; the coverage record must state the gap.

## Edge cases and non-goals

Provider rows may change country, codec, URL, availability, or order. Reject malformed, unsupported, duplicate, credentialed, explicit-port, playlist, or unlisted source URLs. Direct candidate qualification rejects redirects. Native `HTMLAudioElement` playback may follow a redirect; host CSP behavior and the actual destination must be checked during host verification, with gaps recorded. Never accept a user-supplied stream URL or add an open proxy. Handle provider timeout, invalid/oversized response, empty/short page, stale/out-of-order response, and audio failure without a false playing or complete-coverage claim.

No general search, recommendations, favorites, artwork, accounts, saved state, codec expansion, AAC/FIP support, stream proxy, hosting, publication, deployment, or automatic merge. Radio Nova and Meuh exact overrides from DIAL-006 remain; FIP AAC remains excluded.

## Acceptance

1. A dated coverage report identifies exact provider UUID, name, country, codec, URL, page and direct probe result for at least one implemented candidate in **each** of FR, GB, US, CA, DE, JP, ES, IT. The report distinguishes catalog admission, direct MP3 reachability, and audible ChatGPT host playback. No partial eight-country claim passes this criterion.
2. The only new media origins are the two exact HTTPS origins in TECH.md, with no new UUID override. Server filtering, browser source validation and CSP agree exactly. Existing exact Meuh/Nova overrides retain provider UUID click attribution. No arbitrary media URL, wildcard domain or proxy appears. Direct probes do not admit redirecting candidates; any runtime browser redirect is subject to host CSP and host verification.
3. DIAL-006's reviewed 50-row/three-page/30-choice bounds, deduplication, More retry, stale-response guards, selected marker and audio continuity, neutral Studio UI, coordination, attribution and disclosure still work.
4. Independent Review evaluates the final exact candidate; independent Verify covers automated regressions, fresh dated provider/direct stream checks for newly admitted origins, and owner ChatGPT host QA for representative eight-country playback, CSP, layout, More-state preservation, Pause and click disclosure. Any unobserved or failed country/host gate is `BLOCKED` or `FAIL`, never `PASS`. The owner decides coverage acceptance before any hosting work.
