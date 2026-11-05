# Current checkpoint — DIAL-003 planning

DIAL-003 is WAITING_FOR_SPEC_APPROVAL after real Luna Triage and Sol/high Spec. Branch work/DIAL-003. Read factory/work-items/DIAL-003/PRODUCT.md and TECH.md. Exact proposed hashes: PRODUCT 3dc151e49b28a8c555482db1cbe888b69c9b91b30e7044223ac8bf3a9970f19e; TECH 686e2f79f643581f8aa3aa0c88c05202d15baf88e8f97d94ce4ab7f3f74f12db. No production implementation started. Owner requested next phase and roadmap; that is not exact approval of these newly drafted design choices.

Proposal: same browser profile/device, Play in another thread takes over, remote Pause can stop active playback, exclusive Web Lock plus BroadcastChannel, bounded fail-closed behavior. First build only the actual two-thread ChatGPT capability experiment. If message/lock scope or post-transfer playback fails, stop and revise/park; no silent server/identity fallback. Cannot establish coordination by testing a singleton or mocks alone. Pending approval intervention is recorded.

Roadmap is docs/ROADMAP.md: cross-thread playback, then proposed reliability/recovery/operations, broader stations including FIP, and later favorites/state with explicit identity/storage decisions. Owner priority question remains optional/pending; sequence is a proposal.

Existing DIAL-002 work was pushed at 2a6b449. User requested a PR to main: remote had no main, so main was created from existing factory/bootstrap 487e865. PR #2 https://github.com/sjfortin/dial-factory/pull/2 is OPEN, mergeable, targets main, and is not merged. The default branch remains factory/bootstrap; no default-branch change was requested or performed. Do not auto-merge. DIAL-002's dated station-specific evidence gap remains as recorded below; no invented waiver. New phase can be planned independently.

Prior DIAL-002 records below are historical context; use canonical work-item ledgers for exact states.

# Resume Dial Factory

Updated 2026-11-05. DIAL-002 is WAITING_FOR_HUMAN (resume VERIFYING) on work/DIAL-002. Read its canonical state.json before resuming; older session instructions have been replaced by this checkpoint.

## Accepted candidate and checks

Product candidate: 542a2b3 (full 542a2b32d4e7ac3cfec69657667567994af04aec), implementation attempt 2. The saved repair report was reconciled into the ledger. Fresh independent Review run-2bcbd8849cb6 ACCEPTED it; full authorized npm test passed 19 tests. Foreman also ran the authorized full suite with 19 passes. Approved PRODUCT.md and TECH.md hashes are unchanged; no new specification approval is needed.

Live MCP Inspector evidence is under factory/work-items/DIAL-002/evidence/verify-finish/: tools/list, country UI resource, invalid ZZ input, FR (3 supported stations from first 50), GB (6 from first 50). These are protocol/catalog observations, not audible playback evidence.

## Verification recovery

Historical worker contexts were unavailable at resume. Luna Verify run-c6aaf171bb07 was closed BLOCKED after repeated status/evidence coordination failures; its initial partial report was not accepted into the ledger. Sol replacement run-cfb0b5079830 captured the live Inspector evidence but a daemon restart lost its context before the final report. It was closed BLOCKED with the preserved evidence referenced. Sol recovery run-5d1ef59d8f7d assessed those saved outputs and its report is recorded: criteria 1, 2, 5, 6 PASS; criteria 3, 4, 7 BLOCKED solely for missing actual host observations. The item is WAITING_FOR_HUMAN, resume VERIFYING; a pending host-verification intervention is recorded. Preserve these attempts and the distinction between source observations and later evidence assessment. Token/cost data remain unavailable.

## Latest owner QA and next phase

Owner reinstalled Dial, confirmed the connection worked, and then responded "Okay it's all working" to the two-country playback checklist. Evidence is evidence/owner-host-qa.md. Fresh independent Verify run-b71604a6bf99 records criteria 1–6 PASS, with 3/4 attributed to owner report, and criterion 7 BLOCKED solely for missing dated station-specific host evidence required by approved PRODUCT.md. Do not invent station identities, dates, formats, or a waiver. Owner was asked for the two FR/two GB station names and date; source origins/formats can then be matched to saved catalog metadata where appropriate. Current state is WAITING_FOR_HUMAN, resume VERIFYING. No failed behavior is asserted.

Owner explicitly authorized commit and push of current DIAL-002 work. No merge was authorized. Next phase is recorded as DIAL-003 INTAKE: coordinate playback across ChatGPT threads so two streams cannot play at once and define coherent Play/Pause behavior. See its REQUEST.md and provisional criteria. No DIAL-003 implementation has started.

## Previous host-check instructions (mostly completed)

Obtain actual ChatGPT host evidence against the repaired candidate: refresh the existing authorized MCP connection after rebuilding/restarting the server; request stations for FR and GB; test two distinct stations in each country. Observe visible selection, no autoplay on selection, audible Play, silence on Pause, audible resume, and stopping the previous stream when switching. Record date/time, station names/IDs, candidate served (if known), and any visible error. See evidence/verify-finish/host-checklist.md under DIAL-002. Do not assume the local build is the version behind a preexisting HTTPS endpoint.

Stable endpoint update: owner requested reusing Tailscale. With command approval, `tailscale funnel --bg --yes http://127.0.0.1:8787` replaced the inactive port-4312 route and enabled public Funnel. https://macbook-air.tail10dbb3.ts.net/mcp passed actual Inspector tools/list. Use this endpoint; see evidence/tailscale-endpoint.md under DIAL-002. Dial is still a manually started process; automatic startup is not configured. Historical temporary endpoint update: owner requested restoring test access, and command approvals allowed a temporary Cloudflare Quick Tunnel. Endpoint https://owner-integrity-mary-wilderness.trycloudflare.com/mcp passed public Inspector tools/list; details/session IDs are in factory/work-items/DIAL-002/evidence/temporary-endpoint.md. Treat it as temporary and check reachability before reuse. No merge, publication, or production deployment is authorized. Local test listener status may have changed across the daemon restart; do not kill an unidentified process or assume a listener is the intended candidate. If the authorized ChatGPT endpoint is unavailable, ask for the minimum access/setup information needed. Do not repeat completed local checks without a concrete gap.

After the actual human observations arrive, Foreman records the intervention, resumes VERIFYING, and dispatches independent Verify to assess them. Product changes require Implement then fresh Review before Verify. Do not claim DIAL-002 COMPLETE or terminal PASS before required evidence exists.

## Prior phases

FACTORY-BOOTSTRAP is COMPLETE/PASS with independent Review/Verify and Foreman handoff. DIAL-001 was explicitly accepted and closed by the owner; its rendered controlled error-state check remains waived/deferred in docs/backlog.md, not a fabricated pass. Do not reopen it. DIAL-001 PR #1 was explicitly authorized and merged previously; that does not authorize any automatic DIAL-002 merge.

Foreman owns routing and lifecycle records; only Implement changes production files. Use real collaboration workers and factory/factory.json model policy, with fresh focused packets after context loss. Public repository: https://github.com/sjfortin/dial-factory. No automatic merge, deploy, or publishing.
