# Resume Dial Factory v0

## Current checkpoint

Human requested a stopping point due session limits. Work is PARKED, resume at BUILDING / revision 1. Repository: `/home/sam/Work/dial`, branch `factory/bootstrap`. Nothing pushed, merged, deployed or published. DIAL-001 has not started.

The approved specification is `docs/BOOTSTRAP-CONTRACT.md`. User also approved model selection so lower-cost workers handle bounded work. Do not ask for bootstrap approval again. Do not begin Dial until this scaffold passes independent Review and Verify.

Initial implementation candidate: `027fdadea9f2c4250276944b06a11b44a7ff0a37`, based on approved contract commit `ffef4f0`. Six initial tests passed, but independent Review returned REVISE and Verify returned FAIL. No revision edits were started before stopping. Later checkpoint commits preserve records/docs only; they do not repair this candidate.

## Real agents and requested settings

| Role | Actual agent used | Model / reasoning |
| --- | --- | --- |
| Foreman | `/root` | inherited session |
| Implement | `/root/factory_implement` | gpt-6-sol / high |
| Review | `/root/factory_review` | gpt-6-astra / medium |
| Verify | `/root/factory_verify` | gpt-6-luna / medium |

Triage defaults to Luna/medium; Spec to Sol/high; routine Implement to Sol/medium. Configuration is `factory/factory.json`. Requests are known; backend model and per-worker usage/cost are not independently exposed and remain null. See `docs/MODEL-SELECTION-EVIDENCE.md`.

Workers really executed independent tasks. Same-worker follow-up was tested. Context and agent-tree persistence across a new session are unproven. First inspect available agents. Reuse original workers if available; otherwise create fresh workers with `fork_turns=none`, required role packets and explicit models, and record replacement/context loss. Do not claim an old agent was resumed if it was recreated. Foreman must route work, not repair production code itself.

## Next actions

1. Read root AGENTS.md, approved contract, `factory/README.md`, and the reports below. Inspect actual Git status before editing.
2. Dispatch Implement to fix R1–R4 with regression tests. Preserve this work item's identity; this is revision 1, not a new bootstrap.
3. Have independent Review examine the replacement commit; send any findings back to Implement.
4. Have independent Verify run the real CLI in a disposable checkout. Evidence must match the replacement commit and cover the invalidation/recovery cases. If Review/Verify run concurrently, both must accept the same candidate before handoff.
5. Record bootstrap outcome and metrics honestly, complete its journal and sanitized public notes, then admit DIAL-001 through the CLI and a real Triage worker. Let Triage inform whether to skip Spec. Do not invent a bootstrap Triage report to satisfy the new recorder.

The four outstanding defects, independently reproduced against 027fdad:

- **R1:** An older Verify PASS remains eligible after a newer Verify run is closed FAIL. Select eligible evidence from the latest run, including RUNNING or closed runs with no report. Cover Implement and Review too.
- **R2:** Verify FAIL -> BUILDING -> REVIEWING -> VERIFYING can reuse old Implement/Review evidence. A new Review report may then be rejected as a duplicate, stranding the work item. Require and permit a fresh implementation attempt and independent review for each revision.
- **R3:** Editing approved PRODUCT.md after entering REVIEWING does not prevent passing handoff. Keep exact-content approval valid through downstream gates and provide a route to reapproval/fresh evidence.
- **R4:** A failed journal write after canonical handoff save can leave the item completable without journal/public notes. Recover required artifacts idempotently and prevent incomplete delivery.

## Durable evidence

- `factory/work-items/FACTORY-BOOTSTRAP/implement-1.json`: actual Implement result transcribed by Foreman.
- `factory/work-items/FACTORY-BOOTSTRAP/review-1.json`: actual independent reviewer report with exact findings.
- `factory/work-items/FACTORY-BOOTSTRAP/verify-1.json`: actual independent verifier FAIL report.
- `factory/work-items/FACTORY-BOOTSTRAP/evidence/review-1-reproductions.py`: preserved independent synthetic reproductions. Inspect paths before rerunning; original expected `/tmp`/old source context may need adapting in a disposable workspace. Its tests assert the old defective behavior, so fixes should make those old assertions fail; create positive regression assertions in the suite.
- `factory/work-items/FACTORY-BOOTSTRAP/evidence/verify-1-cli-evidence.log` and `verify-1-final-state.json`: actual synthetic CLI failure transcript/state.
- Dispatch receipts and `orchestration-events.jsonl`: actual routing, one worker interruption/checkpoint, review failure, verification failure, human pause.
- `factory/improvements/FI-001.md`: reviewable proposal to strengthen regression checks. Approved contract already requires these behaviors.

Original Verify report used short agent name `factory_verify` and grouped some PASS claims based only on the unit suite. Preserve it as received; Foreman recorded that limitation. Next report must use full canonical identity, narrow claims, and durable relative evidence references. No audio/UI verification exists.

## Boundaries and remaining gaps

The Python CLI records and validates runs; only the live harness actually launches workers. Current workers share tools/files; worktrees are not security isolation. The recorder is not a daemon and cannot attest that an evidence claim is true. Bootstrap raw receipts are intentionally outside the new CLI because it did not yet exist at dispatch time.

No connected browser surfaces were discovered. GitHub connector authenticated but no Dial repo was found and remote writes were not tested. DIAL-001 will need honest ChatGPT/audio verification, potentially minimum human assistance. No production deployment is in scope.

Factory metrics at checkpoint: first Review REVISE, first Verify FAIL, one combined revision batch pending, no human implementation. Approval/model preference and requested pause are recorded human interventions. Intake-to-handoff cycle time is not final because no handoff occurred. Costs and tokens are unknown, not zero. Bootstrap metrics are separate from the future DIAL-001 sample.
