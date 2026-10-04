# Dial country radio MCP Apps proof

Dial has two local proof tools. `open_radio` preserves the DIAL-001 Radio Paradise player. `find_stations_by_country` accepts an assigned ISO 3166-1 alpha-2 code such as `FR` or `GB`, then shows up to 10 selectable stations from the first 50 Radio Browser results in provider vote order. Select a station, then press Play. Selection stops the prior stream and resets the player to idle; Pause, resume, and retry use the same audio element. This is an in-instance selection only. There are no accounts, favorites, saved state, general search, or background-playback guarantees.

## Run and inspect locally

Requires Node 20 or newer. Run `npm ci`, `npm test`, then `npm start`. The default MCP endpoint is `http://127.0.0.1:8787/mcp`; `PORT` and `HOST` can be set for local tests. With a second terminal:

```sh
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/list
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name find_stations_by_country --tool-arg countryCode=FR
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name find_stations_by_country --tool-arg countryCode=ZZ
```

The country resource is `ui://dial/country-v1.html` (`text/html;profile=mcp-app`). Its UI consumes the same structured station array returned by the tool. Country input is trimmed and uppercased, then checked against a 249-code checked-in ISO 3166-1 alpha-2 set from IANA tzdata's public-domain `iso3166.tab` dated 2025-07-01. Missing or unassigned codes return `invalid_country` without a provider call. Empty provider results return `no_stations`; a nonempty first 50 with no eligible streams returns `no_supported_stations`; network/configuration, timeout, HTTP, malformed JSON, or oversized response returns `provider_unavailable`. These are distinct tool and UI states. The response includes `searchedCount`, `limit: 50`, and at most 10 rows. No pagination is offered.

## Provider, media, and CSP

The server queries one Radio Browser HTTPS origin, `https://de1.api.radio-browser.info`, or `RADIO_BROWSER_API_ORIGIN` if set to another HTTPS origin. It requests `/json/stations/bycountrycodeexact/{code}?order=votes&reverse=true&offset=0&limit=50&hidebroken=true`, sends an identifying User-Agent, aborts after 5 seconds, and rejects responses above 512 KB. There is no retry cascade. Provider documentation: [Radio Browser API](https://docs.radio-browser.info/).

Rows require a UUID, matching country, nonempty name, MP3 codec, and direct HTTPS URL without credentials, custom port, fragment, or playlist suffix. Duplicate IDs are removed in provider order. Only these exact stream origins are playable and appear in the resource's `resourceDomains`: `https://stream.radioparadise.com`, `https://audio.bfmtv.com`, `https://media-ssl.musicradio.com`. The allowlist is fixed in the build; catalog data cannot expand it. `connectDomains` is empty because Radio Browser requests occur on the server. The iframe audio element requests media directly. Dial does not proxy or fetch the stream URL on the server. A redirect to an unlisted origin can be blocked by host CSP and shows a retryable selected-stream error. MP3 metadata and HTTPS do not guarantee stream availability or ChatGPT compatibility.

Dynamic provider names and metadata enter the UI through text nodes only. No provider logo, frame, or station homepage is loaded. The app-only `report_station_click` tool calls Radio Browser's `/json/url/{stationuuid}` after a user-initiated Play reaches the media element's `playing` state. A five-minute HMAC token bound to the provider UUID prevents arbitrary UUID forwarding; it is invalid after process restart. The provider receives the station UUID/play event and server IP. Click reporting is best effort, has a 1.5-second timeout, and cannot interrupt audio. A later explicit resume can count again. The player does not use the counter endpoint's returned URL.

## Host verification

Automated tests exercise provider limits/filtering, input and failure states, UI text rendering and selection, audio state transitions, and MCP tool/resource delivery. MCP Inspector establishes the protocol behavior, not audible media playback. A ChatGPT host tester must connect an authorized HTTPS `/mcp` endpoint, refresh the connection for the new resource version, and record visible selection plus audible Play/Pause/resume on two distinct stations in each of FR and GB. Record time, station IDs, URLs, codecs, and origin/redirect observations. A catalog snapshot and local tests do not establish host playback. If live catalog or host media behavior prevents a criterion, report it as blocked with the observed evidence.

The original `open_radio` resource remains `ui://dial/radio-v2.html` with its one-origin CSP. This implementation does not deploy a public endpoint.
