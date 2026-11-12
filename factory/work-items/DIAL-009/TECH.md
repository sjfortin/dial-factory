# DIAL-009 — exact candidate registry and NTS gate

## Approval and architecture

Foreman obtains owner approval of the exact SHA-256 revisions of this file and PRODUCT.md before Implement changes production files. Base on the independently accepted DIAL-008 candidate; if DIAL-008 changes, reconcile this spec before build. Retain the existing server-side Radio Browser collector, finite browser media policy, MCP App resource, player controller and playback coordinator. The bounded registry below adds **UUID + country + exact canonical HTTPS URL** matches, not general permission for every stream on an origin. No server-side media probe occurs during user searches.

## Fixed country candidate registry

Source for each row: `https://de1.api.radio-browser.info/json/stations/bycountrycodeexact/{CC}?order=votes&reverse=true&offset={OFFSET}&limit=50&hidebroken=true`, sampled 2026-11-12 UTC. `offset` is the sampled page, not a durable station position. Each row declared the given country and `MP3`; URL is the provider `url_resolved` value. Direct checks disabled redirects, requested bytes 0–255, read at most 256 bytes, and used an 8-second deadline. `200/206 MP3` below means that HTTP status, `audio/mpeg`, and first bytes with an MP3 frame sync (`ff fb` or `ff fa`) at that instant. It is **not** audible playback evidence.

| Country | Offset | Station · UUID | Exact stream URL | Direct check |
| --- | ---: | --- | --- | --- |
| US | 0 | Miami Beach Radio · `cd477c35-d625-11e8-a54a-52543be04c81` | `https://streaming.radiostreamlive.com/miamibeachradio_devices` | 206 MP3 |
| FR | 0 | Jazzradio.fr Jazz & Classique · `c5bc6ba3-5adf-4bb6-8982-82d53a682799` | `https://jazz-wr17.ice.infomaniak.ch/jazz-wr17-128.mp3` | 200 MP3 |
| JP | 0 | Fred Film Radio (日本語) · `5a2cbfe7-0518-44e9-aca6-0fd41e466ff0` | `https://s10.webradio-hosting.com/proxy/fredradiojp/stream` | 200 MP3 |
| GB | 0 | TMM 1 · `9619e7d7-0601-11e8-ae97-52543be04c81` | `https://listen-msmn.sharp-stream.com/nme1.mp3` | 200 MP3 |
| CA | 50 | Radio Pakistan Toronto · `c682befa-3e57-4db1-b1f2-dfcedb93f4d0` | `https://s3.radio.co/s3b10a57ef/listen` | 200 MP3 |
| DE | 0 | 0 N 70s on Radio · `6cddaca1-f2c1-11e8-a471-52543be04c81` | `https://0n-70s.radionetz.de/0n-70s.mp3` | 200 MP3 |
| ES | 0 | #1 Splash 90s Dance · `f3081f41-531f-4e38-88bc-8e1a699635c4` | `https://c6.auracast.net/radio/8090/radio.mp3` | 200 MP3 |
| IT | 50 | 70 80 Disco Funk ModernSoul e Boogie · `4df24bb0-2794-498f-bdc0-0c3d6b71ed95` | `https://discofunk.streamingmedia.it/play` | 200 MP3 |
| AU | 0 | The Prog Rock Machine · `3af3be8d-da3e-4051-a604-d5958f410732` | `https://theproganrockmachine.out.airtime.pro/theproganrockmachine_b` | 200 MP3 |
| BR | 0 | Rádio Mix FM 88,9 MHz (Juiz de Fora) · `193e3072-b88d-4e33-90e7-fb1564713e95` | `https://stream02.ouveai.com.br/8034/stream` | 200 MP3 |
| MX | 0 | Rock 101 · `7a163be5-9e29-11e9-a787-52543be04c81` | `https://s3.radio.co/s2c1cebae5/listen` | 200 MP3 |
| KR | 0 | Big B Radio - Kpop · `7a72aa80-3902-4d73-a548-db81ac780240` | `https://antares.dribbcast.com/proxy/kpop?mp=/s` | 200 MP3 |
| IN | 0 | Bollywood 2010's · `0db90d9a-4ecc-450c-b8fa-695405b24587` | `https://drive.uber.radio/uber/bollywood2010s/icecast.audio` | 200 MP3 |
| ZA | 0 | East Coast Gold · `dd493e42-1c7c-4256-8277-53cf61452d88` | `https://live.ecr.co.za/ecrgoldhigh.mp3` | 200 MP3 |
| NL | 0 | NPO 3FM · `0c62b9d7-8de0-4693-9842-6bf9b50229d3` | `https://icecast.omroep.nl/3fm-bb-mp3` | 200 MP3 |
| SE | 0 | Bandit Classic Rock · `40dfa430-7988-4b02-ae1b-ce5fe8b5aad3` | `https://wr11-ice.stream.khz.se/wr11_mp3` | 200 MP3 |

All 16 direct checks succeeded as described after replacing two failed initial leads: JP Miku Radio returned 401; IT RAI 2 returned 302 to a transient CDN URL. SE SceneSat returned 200 `audio/mpeg` but its first eight bytes were not an MP3 frame; Bandit was probed instead. These exclusions illustrate why provider codec alone is insufficient. No official broadcaster ownership check was made for the 16 directory names/countries; provider metadata is a catalog assertion. Recheck row, direct URL and country immediately before candidate acceptance.

## Components, data and trust boundary

- `src/discovery.ts`: retain ISO validation, exact-country lookup, three bounded pages, 5-second/512 KB response guard, redirect rejection for provider JSON, ordering, 30-choice/dedupe limits, existing exact overrides, click tokens, and retry result contract. For a new-origin URL, accept a row only if its UUID, country, `MP3` codec, and canonical `url_resolved` exactly match one table entry. Reject changed URLs, explicit ports, credentials, fragments and playlists. Existing approved-origin behavior remains as reviewed in DIAL-008. Do not treat the table as a hardcoded catalog: the matching provider row must be present on that scan. Mark a missing candidate as absence in verification evidence, not as a runtime error.
- `src/media-policy.ts`, `src/station-list.ts`, `src/server.ts`: share the finite exact additional URL/origin policy. The server applies the UUID + URL binding; the browser revalidates exact candidate URLs before rendering/playing. A new origin must never become a general admission rule for other provider rows. CSP `resourceDomains` contains only the finite origins actually required by admitted exact URLs; no `*`, `*.radio.co`, `*.radiomast.io`, or broad parent domain. Keep `connectDomains` unchanged unless independent host evidence proves an exact needed origin. Update resource URI to invalidate old host caching when the contract changes. This is a policy expansion, so independent Review checks every path that can reach `<audio src>`.
- `public/discovery.html`, `src/player.ts`: add a labeled 16-country select and Countries/NTS navigation with semantic buttons; call the existing country tool with the chosen code and retain generation/stale guards. The tool invocation from chat still works for any assigned ISO code. Keep one audio element and one playback controller. Show NTS source/attribution separately; do not mint Radio Browser click tokens for NTS or call its click tool. Use text nodes for provider names and any error text. Selection alone does not play. Switching collections must not bypass lock/remote pause. Keep minimal CSS, usable focus and responsive widths.
- No new service dependency, storage, recommendation engine or media proxy. No station metadata from NTS APIs or live schedule is needed.

## NTS compatibility gate

[NTS's own support article](https://ntslive.freshdesk.com/support/solutions/articles/77000587257-tunein) supplies `https://stream-relay-geo.ntslive.net/stream?client=direct` and `https://stream-relay-geo.ntslive.net/stream2?client=direct`. On 2026-11-12 UTC, each returned 302 to `https://streams.radiomast.io/nts1` or `/nts2`, which returned 302 to `https://audio-edge-kkqan.sin.d.radiomast.io/nts1` or `/nts2`; those final endpoints returned 200 `audio/mpeg` and MP3 frame bytes. This is one network vantage and time. The geo relay and edge host are not in the current finite policy. Their stability and ChatGPT CSP behavior are unknown.

Before enabling in-player NTS audio, Implement must present a **finite exact-origin redirect route** supported by fresh checks from at least two independent times or network vantage points, plus a real ChatGPT host CSP/audio check for both channels. Review must inspect the entire chain, exact path constraints, provenance, and failure behavior. If the route cannot be bounded without wildcard host permission, the gate fails: keep the two NTS rows and official-site links, disable in-player Play for them, and report NTS host playback BLOCKED. A later route or a proxy requires a new approved spec revision. A single observed `audio-edge-kkqan` address is insufficient. If a previously accepted route changes, fail closed with the NTS link and clear error; do not follow an arbitrary new destination.

## Verification and failure handling

- Tests: exact UUID/country/URL matching for every new-origin candidate; rejects same-host different URL, changed query, wrong country/codec, explicit port, redirect/playlist and malicious provider text; existing-origin policy and DIAL-008 three-window/30-cap/8-reveal/retry/stale/coordination regressions; NTS source type never reports a Radio Browser click; gated NTS controls have a safe link-only state; source switch and Play/Pause use one audio/controller.
- Build/typecheck and focused automated suite. Independent Verify repeats a dated bounded directory scan for all 16 countries, captures candidate UUID/URL matches and compatible counts, and performs capped direct probes for admitted candidates. It separately records `catalog`, `direct HTTP/bytes`, `host CSP`, `host audible Play/Pause/resume`, and UI/coordination evidence, each PASS/FAIL/BLOCKED. Direct bytes cannot substitute for host audio. Test narrow/desktop widths, light/dark, keyboard and long names in the real host when available. Review and Verify use identities separate from Implement and bind to the same candidate commit.
- If a stream stops, the player shows a clean error and remains selectable. If a country scan fails, retain DIAL-008 partial/retry semantics. If a candidate drifts, remove only that admission or revise this spec and repeat approval; never loosen origin policy silently. If the NTS gate fails, link-only NTS is the defined fallback. Regressions route back through Implement, then fresh Review and Verify. Roll back the candidate commit to the accepted DIAL-008 baseline if the catalog/UI policy breaks existing playback. No merge, publish or deploy.
