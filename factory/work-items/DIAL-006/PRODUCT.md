# DIAL-006 — eight-country coverage and bounded browsing

## Problem and decision gate

Country discovery currently examines 50 Radio Browser rows and returns at most ten MP3 stations from three media origins. A live sample on 2026-11-06 found accepted rows in FR and GB but none in the first 150 rows for US, CA, DE, JP, ES, or IT. The owner wants useful coverage across those eight countries and a way to see more compatible stations. This specification requires the owner's approval of its exact revision before production implementation. Hosting is a later phase after the owner accepts coverage; this work makes no hosting or launch change.

## Behavior and UX

- Support country requests for FR, GB, US, CA, DE, JP, ES, and IT using the existing assigned ISO alpha-2 validation. Do not imply that every catalog row will play. Describe measured provider results, accepted rows and stream checks by country in the handoff.
- The initial country request shows up to ten compatible choices from the first 50 provider rows. A compact **More stations** button scans the next 50 rows per press, at most two presses. Display at most 30 choices after at most 150 provider rows. Append new compatible choices in provider order. Show the inspected range and whether another page remains. The button never starts audio.
- Suppress rows with duplicate canonical UUIDs or identical accepted stream URLs across loaded pages. The provider can list the same audio under different names and URLs; do not claim semantic deduplication. Preserve the selected marker and current audio state when a later page arrives, has no compatible rows, or fails. A genuinely new country request retains the existing reset and stop behavior.
- A later-page error leaves the loaded choices and current playback intact, shows a retryable message, and retries the same page. An empty page or the third page ends browsing. Results can shift between live provider requests; show that pagination is a bounded scan, not a stable complete catalog.
- Keep the selected Studio player title, neutral compact card, restrained results, readable narrow/light/dark layout, keyboard focus, status text, Radio Browser attribution, and the disclosure that a click is reported after user-initiated playback starts. Selecting a row remains separate from Play. Preserve same-browser playback coordination and its truthful remote status.
- FIP, Radio Nova, and Radio Meuh are investigation targets, not guaranteed included stations. The sampled Radio Browser rows for FIP use AAC or HTTP MP3; the sampled Nova and Meuh rows use HTTP MP3. Direct HTTPS probes found a 200 `audio/aac` FIP endpoint and 200 `audio/mpeg` Meuh and Nova endpoints. A curated HTTPS URL may be used only for an exact provider UUID after verification and within the finite policy in TECH.md. Host playback remains unverified.

## Measured feasibility and limits

A read-only query of `de1.api.radio-browser.info` on 2026-11-06 requested offsets 0, 50, and 100, 50 rows each, ordered by votes with `hidebroken=true`. All eight returned 50 rows per page. Under the current three-origin MP3 filter, the 150-row sample held FR 6 accepted UUIDs (several share the same stream) and GB 6; US, CA, DE, JP, ES, IT each held 0. This is a dated sample, not a completeness or audibility guarantee. Direct, redirect-rejecting 256-byte HTTPS probes returned MP3 bytes and `audio/mpeg` for one US (SomaFM), CA (radio.co), IT (United Radio), Meuh, and Nova stream. The sampled DE SWR, JP Gensokyo, and ES Los 40 URLs returned redirects; their final destinations and host CSP behavior were not established. No ChatGPT audio or UI evidence was collected in Spec.

## Edge cases and non-goals

Handle invalid country, provider timeout/invalid/oversized response, empty page, no compatible rows, duplicate rows, stale or out-of-order page results, and stream errors without false playback claims. A selected station may be absent from newly fetched rows but remains selected until the user changes country or selection. Keep user-supplied or provider-supplied URLs out of tool inputs; do not expose an open stream proxy.

No general station search, recommendations, artwork, favorites, accounts, saved state, cross-device playback, codec expansion, streaming proxy, deployment, hosting, public launch, or automatic merge. Do not add an origin simply because Radio Browser lists it. If a candidate fails direct HTTPS and host playback checks, record the gap instead of weakening the media policy.

## Acceptance

1. The delivered coverage document gives dated, per-country provider sample and accepted/playable evidence for all eight countries, including any gaps and FIP/Nova/Meuh outcomes. At least one newly accepted direct HTTPS MP3 candidate is implemented for each of US, CA, and IT based on the Spec probes; DE, JP, and ES require an accepted candidate or an explicit BLOCKED result with redirect/CSP evidence. Do not label catalog inventory as audible playback.
2. More stations scans no more than three 50-row pages and shows no more than 30 validated choices, suppresses duplicate UUIDs and exact stream URLs, and preserves selected/playing state on success, empty pages, failure, and retry.
3. Studio, playback coordination, finite origin policy, provider attribution, and best-effort click reporting after playback starts remain intact. No user/provider-controlled arbitrary media origin or server proxy is introduced.
4. Independent Review and Verify assess the exact candidate with relevant automated regressions, dated provider and direct stream evidence, and owner ChatGPT host QA for layout, playback, more-stations state preservation, and disclosure. Missing host or audible evidence is BLOCKED, not PASS.
