# DIAL-002 triage source notes

Checked 2026-10-04. These notes capture the primary documentation points used to assess feasibility; provider availability and behavior can change.

## Radio Browser API

Primary API reference: <https://docs.radio-browser.info/>

- Station country filtering can use `/json/stations/bycountrycodeexact/{searchterm}` or `/json/stations/search?countrycode=XX`; the search parameter is a two-letter ISO 3166-1 alpha-2 code. Search returns an array of station records.
- Station list endpoints support `limit`, `offset`, and `hidebroken`. The documented default limit is 100000, so a client must pass a bounded limit instead of relying on defaults.
- Station records include dynamic station metadata and stream URLs; the UI must treat names/tags as text and URLs as untrusted data.
- The docs say clients should call the station click counter when a user starts a stream. `/json/url/{stationuuid}` increments the counter (at most once per source IP/station/day) and returns detailed stream information. Whether DIAL should make that request needs an explicit implementation decision because it discloses a playback event to the provider and introduces another request/failure path.
- The API documents mirror discovery through `/json/servers` and says DNS discovery can be used by clients. Choosing a fixed mirror is the smallest initial integration but creates an availability/configuration dependency.

## MCP Apps and ChatGPT UI

Primary OpenAI docs:

- <https://developers.openai.com/plugins/build/chatgpt-ui>
- <https://developers.openai.com/plugins/build/app-quickstart>

- MCP Apps UI runs in an iframe. The resource metadata CSP separates `connectDomains` (fetch/XHR/WebSocket) from `resourceDomains` (scripts, styles, images, other loaded resources); allowlists should declare the origins actually used.
- Tools should remain useful without a rendered component. UI state such as a selected row is ephemeral to the UI instance; authoritative station data should come from the server/tool result.
- The Quickstart connects ChatGPT to the public MCP `/mcp` endpoint; local test coverage cannot establish host rendering or audible playback.

## DIAL baseline observations

- `src/server.ts` exposes `open_radio` and a fixed UI resource with only `https://stream.radioparadise.com` in `resourceDomains`.
- `src/player-controller.ts` owns the current audio element and click-driven Play/Pause/retry state. `public/player.html` is fixed to the DIAL-001 stream.
- `test/server.test.js` checks the returned tool/resource, exact bundled script, and fixed CSP metadata; `test/player.test.js` covers player transitions. These tests provide a useful seam for provider normalization and dynamic selection tests, but do not prove dynamic origins are permitted in ChatGPT.
- DIAL-001's host error-state criterion was explicitly waived/deferred by the owner. DIAL-002 must preserve that record; new provider validation/no-results/failure outcomes remain in scope.

## Branch / integration dependency

- DIAL-002 is on `work/DIAL-002` at `d49be43`, whose parent is DIAL-001 candidate `80d6994`; DIAL-001's accepted product commit is `ac6ae02` and final audit is `d49be43`.
- Per the intake packet, PR #1 targets the current default factory/bootstrap and is still unmerged. This DIAL-002 branch is stacked on DIAL-001 for planning only. Before implementation, Foreman must resolve integration against the pending PR/default branch and avoid treating the DIAL-001 waiver as reopened work.
