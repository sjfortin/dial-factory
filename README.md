# Dial country radio MCP Apps proof

Dial has two local proof tools. `open_radio` preserves the DIAL-001 Radio Paradise player. `find_stations_by_country` accepts an assigned ISO 3166-1 alpha-2 code such as `FR` or `GB`, then collects up to 30 compatible catalog choices from three 50-row Radio Browser windows in provider vote order. The player shows eight at first, then reveals up to eight more per More stations click only when known choices are hidden. Select a station, then press Play. Selection stops the prior stream and resets the player to idle; Pause, resume, and retry use the same audio element. This is an in-instance selection only. There are no accounts, favorites, saved state, general search, or background-playback guarantees.

## Run and inspect locally

Requires Node 20 or newer. Run `npm ci`, `npm test`, then `npm start`. The default MCP endpoint is `http://127.0.0.1:8787/mcp`; `PORT` and `HOST` can be set for local tests.

`npm start` uses Node's supported `--dns-result-order=ipv4first` and `--no-network-family-autoselection` flags for this server process. On the tested machine, Node's default family selection timed out against Radio Browser while this bounded IPv4-first mode completed. This changes only Dial's Node process, not the host network or media policy. With a second terminal:

```sh
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/list
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name find_stations_by_country --tool-arg countryCode=FR
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name find_stations_by_country --tool-arg countryCode=GB
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name find_stations_by_country --tool-arg countryCode=ZZ
```

The country resource is `ui://dial/country-v10.html` (`text/html;profile=mcp-app`). Country input is trimmed and uppercased, then checked against a 249-code checked-in ISO 3166-1 alpha-2 set from IANA tzdata's public-domain `iso3166.tab` dated 2025-07-01. Invalid codes use no provider request. A valid scan attempts offsets 0, 50, and 100 even if an earlier window is short, empty, or fails. The structured result includes each window's outcome, `scanState` (`complete` or `partial`), `choiceLimitReached`, and up to 30 unique compatible choices. `no_stations` means all three successful windows had no rows; `no_supported_stations` means they had rows but no compatible choice. A failed window yields a partial scan, and the UI offers a separate manual Retry scan while retaining existing choices, selection, and audio. More stations only reveals buffered choices and makes no provider call. Catalog inclusion does not prove an audible stream.

On 2026-11-12, a live bounded scan admitted US 10 (1+6+3 across the three windows), FR 4, JP 1, GB 5, CA 2, DE 0, ES 0, and IT 7 compatible catalog choices. All three provider windows succeeded for each country in that observation. Counts can drift; these are catalog admissions, not direct stream reachability or audible ChatGPT host playback evidence.

## Provider, media, and CSP

The server queries one Radio Browser HTTPS origin, `https://de1.api.radio-browser.info`, or `RADIO_BROWSER_API_ORIGIN` if set to another HTTPS origin. It requests `/json/stations/bycountrycodeexact/{code}` at offsets 0, 50, and 100 with `order=votes&reverse=true&limit=50&hidebroken=true`, sends an identifying User-Agent, aborts after 5 seconds, rejects redirects, and rejects responses above 512 KB. A retry occurs only after the user presses Retry scan. Provider documentation: [Radio Browser API](https://docs.radio-browser.info/).

Rows require a UUID, matching country, nonempty name, MP3 codec, and direct HTTPS URL without credentials, custom port, fragment, or playlist suffix. Duplicate IDs and canonical stream URLs are removed in provider order. The exact allowed stream origins are defined in `src/media-policy.ts` and appear unchanged in the resource's `resourceDomains`. The allowlist is fixed in the build; catalog data cannot expand it. `connectDomains` is empty because Radio Browser requests occur on the server. The iframe audio element requests media directly. Dial does not proxy or fetch the stream URL on the server. A redirect to an unlisted origin can be blocked by host CSP and shows a retryable selected-stream error. MP3 metadata and HTTPS do not guarantee stream availability or ChatGPT compatibility.

Dynamic provider names and metadata enter the UI through text nodes only. No provider logo, frame, or station homepage is loaded. The app-only `report_station_click` tool calls Radio Browser's `/json/url/{stationuuid}` after a user-initiated Play reaches the media element's `playing` state. A five-minute HMAC token bound to the provider UUID prevents arbitrary UUID forwarding; it is invalid after process restart. The provider receives the station UUID/play event and server IP. Click reporting is best effort, has a 1.5-second timeout, and cannot interrupt audio. A later explicit resume can count again. The player does not use the counter endpoint's returned URL.

## Host verification

Automated tests exercise provider limits/filtering, input and failure states, UI text rendering and selection, audio state transitions, and MCP tool/resource delivery. MCP Inspector establishes the protocol behavior, not audible media playback. A ChatGPT host tester must connect an authorized HTTPS `/mcp` endpoint, refresh the connection for the new resource version, and record visible selection plus audible Play/Pause/resume on two distinct stations in each of FR and GB. Record time, station IDs, URLs, codecs, and origin/redirect observations. A catalog snapshot and local tests do not establish host playback. If live catalog or host media behavior prevents a criterion, report it as blocked with the observed evidence.

The `open_radio` proof remains available at versioned resource `ui://dial/radio-v9.html` with its one-origin CSP. Both resources use the same browser-only shared playback coordinator. Actual two-thread ChatGPT playback, remote Pause, background behavior, and close/remount recovery still require host verification. This implementation does not deploy a public endpoint.
