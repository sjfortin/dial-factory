# DIAL-009 candidate status

The owner-approved [technical spec](../factory/work-items/DIAL-009/TECH.md) records 16 researched UUID/country/URL pairs. Its failure rule requires excluding a pair that fails a fresh direct stream check, without quietly replacing the URL or broadening the media policy.

On 2026-11-12 07:52 UTC, independent [Verify evidence](../factory/work-items/DIAL-009/evidence/run-fc56cbb3740c/live-scans-and-direct-probes.json) found the exact SE provider row for Bandit Classic Rock (`40dfa430-7988-4b02-ae1b-ce5fe8b5aad3`, `https://wr11-ice.stream.khz.se/wr11_mp3`) in a complete three-window scan. Its bounded no-redirect direct request returned HTTP 500, no content type, and zero bytes. Fifteen other candidate URLs returned direct MP3 bytes in that run. Directory presence is not direct stream reachability, and direct bytes are not ChatGPT playback evidence.

Bandit is therefore excluded from the active exact candidate registry and its now-unused origin is absent from the browser resource CSP. The country picker still includes **Sweden** and the country tool still scans SE through the existing bounded policy. If that scan has no compatible choices, the UI reports that outcome for the scanned windows. This is an explicit SE coverage gap; no replacement stream was approved or added. A future candidate needs fresh evidence and approval under the factory process.
