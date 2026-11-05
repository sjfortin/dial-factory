# Dial resume checkpoint

## Active work: DIAL-003

Branch work/DIAL-003. Owner approved exact PRODUCT.md and TECH.md with response "yrs approved". Approval hashes are recorded in the canonical state. Do not request the same approval again unless the specs change.

The approved design is capability-first: same browser profile/device, second Play takes over after old audio stops, Pause can stop the active player from another thread, and new Play remains silent if ownership cannot be established. Only the capability probe has been built. Full playback coordination must not start until actual two-thread ChatGPT evidence establishes shared messages, exclusive lock scope, lifecycle recovery and post-transfer audible playback. A failed capability gate returns for a revised design or park decision; it does not authorize accounts/server coordination or wider CSP.

Current probe candidate: 7dd7db64ea51cfd601cffbe1bbff83468aa87118, implementation attempt 2, resource ui://dial/capability-probe-v2.html, tool open_capability_probe. Implement's full suite passed 23 tests; independent Review run-f280589cb6a6 ACCEPTED the repair after rechecking both reproduced defects. Prior candidate 96665855 had cancellation and misleading self-contention defects; its failed Review remains in the ledger. Verify run-2e85cb9ca48c independently confirmed tools/list, probe tool call, app metadata/CSP and resources/read; saved outputs are evidence/verify-probe/. Overall remains BLOCKED because the actual two-thread host gate is unobserved and the full feature is intentionally unimplemented. DIAL-003 is WAITING_FOR_HUMAN, resume VERIFYING; the pending host-test intervention is recorded.

Owner procedure: docs/DIAL-003-PROBE.md. Refresh the Dial connection and open the capability probe in two separate ChatGPT threads/tabs in one browser profile. Save both JSON logs and audible observations. A single frame, mock tests, lock availability alone, or a resolved play() promise cannot pass the actual-host gate. Existing radio and country players deliberately remain unchanged; this probe is not the single-playback feature.

After host observations arrive, record the actual owner response, resume the saved stage, and dispatch independent Verify to assess capability evidence. Owner has supplied paired frame logs on 2026-11-06. Reverify run-0d5f037eed14 records capability criteria 1 and 2 PASS: shared-origin bidirectional message delivery, peer lock contention, ordered transfers both ways, and one audible success. Criteria 3–5 and overall remain BLOCKED, mainly because close/remount recovery was not exercised; the second audible annotation is paired with playback=false. A summary is saved in evidence/owner-probe-results.md, but the raw pasted JSON is not stored. Owner should do the close-holder/reopen-peer recovery step in docs/DIAL-003-PROBE.md and paste the peer log or result. The full feature remains unimplemented: route actionable missing implementation through a truthful verification FAIL and BUILDING, then fresh Implement/Review/Verify. Do not force a BLOCKED or staged probe into full PASS, invent missing host observations, or directly edit lifecycle records.

## Development endpoint

https://macbook-air.tail10dbb3.ts.net/mcp uses public Tailscale Funnel, configured in background to proxy http://127.0.0.1:8787. Old inactive root backend port4312 was replaced with command approval. Temporary Cloudflare tunnel was stopped.

Foreman restarted the authorized dev server for the reviewed probe: old own session23177 stopped; npm start session57881 serves port8787. Inspect process/endpoint before reusing after a restart; do not kill unidentified processes. Dial is not configured for automatic startup and still depends on this machine remaining awake/online. Local dev endpoint refresh is not a production deployment or merge.

## Repository and previous phases

Existing DIAL-002 delivery and QA records were pushed at 2a6b449. PR #2 https://github.com/sjfortin/dial-factory/pull/2 is OPEN, mergeable, targeting main and not merged. Remote main was created from the former factory/bootstrap baseline 487e865 at owner's request for a PR to main. The default branch remains factory/bootstrap; no default-branch change was requested. Do not auto-merge.

DIAL-002 owner reports all requested playback checks work. Verify recorded criteria1–6 PASS, with host behavior attributed to owner rather than instrumented observation. Criterion7 remains BLOCKED solely for the spec-required dated station-specific host evidence; names/date were requested but not provided. Do not invent a waiver or reopen successful behavior as a failure. Its state remains WAITING_FOR_HUMAN, resume VERIFYING.

FACTORY-BOOTSTRAP is COMPLETE/PASS. DIAL-001 was explicitly accepted/closed with its controlled rendered stream-error check deferred, not fabricated PASS; see docs/backlog.md. Do not repeat those phases.

## Proposed phases afterward

See docs/ROADMAP.md: reliability/recovery/operations, broader station coverage including FIP, then favorites/remembered state with explicit identity/storage semantics. These are proposals, not approval to implement all future phases. Foreman owns routing/lifecycle, only Implement changes production files, distinct Review/Verify assess each candidate. Use real collaboration agents and factory/factory.json policy. No automatic merge, publication or production deployment.
