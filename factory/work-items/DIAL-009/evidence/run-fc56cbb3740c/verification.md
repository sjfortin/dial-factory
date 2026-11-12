# DIAL-009 Verify — run-fc56cbb3740c

- Candidate: `a840fda41a86063809bb71b0dc60e744bed7461d`, matching HEAD. Attempt 2.
- Independent Review: run-410decd56085 ACCEPTed this exact commit.
- `npm test`: PASS; build succeeded, 38 passed, 0 failed.
- Live scan: `dist/discovery.js`, Node IPv4-first and no-network-family-autoselection, 2026-11-12T07:52:33Z–07:52:47Z. Four concurrent workers each scanned one country at a time. Every country completed all three bounded windows.
- Catalog counts: US 11, FR 5, JP 2, GB 6, CA 3, DE 1, ES 1, IT 8, AU 1, BR 1, MX 1, KR 1, IN 1, ZA 2, NL 1, SE 1. All 16 proposed directory tuples were present (exact UUID/country/MP3/url) and admitted. Existing-country drift from the DIAL-008 scan recorded at 2026-11-12T03:43Z (US10/FR4/JP1/GB5/CA2/DE0/ES0/IT7) was +1 for each of those eight countries.
- Direct probes: GET with Range `bytes=0-255`, redirect manual (no follow), 8-second timeout, maximum 256 response bytes. Fifteen returned 200/206 `audio/mpeg`, 256 bytes and MPEG frame sync. No probe followed a redirect.
- **Original criterion 1 result: FAIL.** The dated coverage measurement found a concrete unusable SE candidate that remains admitted, so the candidate set has not excluded the explicit gap required by the spec.
- **Confirmed gap:** SE Bandit Classic Rock (`40dfa430-7988-4b02-ae1b-ce5fe8b5aad3`, exact approved URL `https://wr11-ice.stream.khz.se/wr11_mp3`) returned HTTP 500, no body/content type. The exact row was still admitted by the current SE directory scan. Per the approved gate, this should route through Implement and fresh Review/Verify; no replacement was sought.
- NTS remains link-only, labeled as editorial channels, with official NTS links and no country claim. Selecting NTS disables in-player Play, hides Radio Browser disclosure and does not send Radio Browser click reporting; full UI tests cover this.
- Direct bytes are not host evidence. No actual ChatGPT host audio/CSP/layout/Pause/resume check was available; host acceptance remains BLOCKED.
- Full structured report: `/tmp/dial009-verify.json`. Raw detailed scans and probes: `live-scans-and-direct-probes.json`.
