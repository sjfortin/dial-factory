# DIAL-009 Verify — run-77886707bfd8

- Candidate: `d4da1f9d1c9bb4c509bd35789fcb676607c3fbde`, matching HEAD; attempt 3.
- Latest independent Review: `run-1165f955264d` ACCEPT for this exact commit.
- `npm test`: PASS; build succeeded, 39 passed, 0 failed.
- Fresh bounded scan through built `dist/discovery.js`: 2026-11-12T08:00:45Z–08:00:54Z; all 16 countries completed offsets 0/50/100. Counts: US 11, FR 5, JP 2, GB 6, CA 3, DE 1, ES 1, IT 8, AU 1, BR 1, MX 1, KR 1, IN 1, ZA 2, NL 1, SE 0. Sweden returned `no_supported_stations` with 0 admitted choices after 150 rows; the picker still contains Sweden.
- The failed SE tuple and its origin are absent from active registry, exact binding, parser policy and derived origins. No SE retry or replacement was made. The explicit SE gap is recorded in `docs/DIAL-009-CANDIDATE-STATUS.md`.
- Direct evidence for the fifteen retained URLs is carried forward from prior Verify at 2026-11-12T07:52:33.918Z. A machine comparison confirms each remaining UUID/URL is unchanged; each prior capped, no-redirect probe returned 200/206 `audio/mpeg`, 256 bytes and MPEG frame sync. No new direct probes were performed.
- No actual ChatGPT host audio/CSP/layout/Pause/resume evidence is available; those checks remain BLOCKED.
- Structured report: `/tmp/dial009-verify-exclusion.json`. Detailed evidence files in this directory.
