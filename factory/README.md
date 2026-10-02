# Factory CLI

Run from any directory with `python3 /home/sam/Work/dial/factory/factory.py`. The CLI records real worker activity; it does not spawn workers. A Foreman should first use the harness collaboration tools with the model in `factory.json` and the matching role contract. Give each worker its packet and run ID. Use `followup_task` for revisions or record a replacement agent. Only the Foreman writes lifecycle records.

For a new item, save a JSON array of nonempty acceptance criteria, then run:

```sh
python3 factory/factory.py create DIAL-001 --title 'Prove live internet-radio playback inside ChatGPT MCP Apps UI' --objective 'Determine whether Dial can reliably play an HTTPS internet-radio stream from an MCP Apps UI inside ChatGPT.' --criteria-file /tmp/dial-001-criteria.json
python3 factory/factory.py advance DIAL-001 TRIAGE
python3 factory/factory.py dispatch DIAL-001 Triage --agent /root/dial_001_triage --model gpt-6-luna --reasoning medium --reason 'bounded repository and feasibility assessment'
```

`dispatch` prints `run-...` and writes `packets/<run-id>.json`. After the real agent returns, save its structured report and record it:

```sh
python3 factory/factory.py report DIAL-001 --run run-... --file /tmp/triage-report.json
```

Use `status ID` to inspect current records, `metrics ID` for derived measures, and `recover ID` to restore event, report, and handoff artifact mirrors from canonical state. To end a dispatched run with no valid report, use `close-run ID --run run-... --result BLOCKED --reason 'specific obstacle'`. A newer run, including one still running or closed without a report, invalidates older evidence for that role. Dispatch records requested model/reasoning, actual harness agent identity, and reason; reported model, token usage, and billed cost stay null unless independently available. A model replacement for the same role requires `--replaces PRIOR_RUN_ID` and a reason; retries can name `--retry-of PRIOR_RUN_ID`.

After Triage, `advance` follows its recommendation. `IMPLEMENT` requires `skip-spec ID --by FOREMAN --reason REASON` first. `SPEC` advances to PLANNING; Spec writes `PRODUCT.md` and `TECH.md` in the item directory, reports, then advance to WAITING_FOR_SPEC_APPROVAL. `approve-spec ID --by HUMAN_IDENTITY` binds exact SHA-256 hashes of both documents. Any edit invalidates that approval. Human waits require `intervene ID --reason ... --question ... --human-response ... --avoidable yes|no --human-implementation yes|no --possible-improvement ...` and resume through the saved stage. Never put private transcripts or secrets in reports.

Implement reports a real candidate commit. Advance BUILDING → REVIEWING and dispatch an independent Review agent. Review ACCEPT advances to VERIFYING; REVISE goes back to BUILDING. Verification covers every criterion and binds the current attempt/commit. A fixable FAIL goes back through BUILDING and REVIEWING. A closed failed Verify run without a report can also return to BUILDING; the next REVIEWING entry needs a fresh Implement report and the next VERIFYING entry a fresh Review report. A terminal experiment FAIL may advance to READY_FOR_HANDOFF only with `--terminal-failure-reason 'why further iteration cannot resolve this'`; its evidence and FAIL result remain visible. PASS or evidenced BLOCKED also advance to READY_FOR_HANDOFF. If approved Spec content changes during Building, Review, Verify, or handoff, close any running agent and `advance ID WAITING_FOR_SPEC_APPROVAL`; reapprove the exact content, advance to BUILDING, and make a fresh Implement and Review attempt. Then `handoff ID --result PASS|FAIL|BLOCKED --summary 'evidence-based outcome'` writes `docs/factory-journal/ID.md` and `work-items/ID/PUBLIC_NOTES.md`; `advance ID COMPLETE` follows only after required artifacts exist. Nothing is published automatically. `intervene` records all human interventions, including human verification assistance. `metrics` distinguishes handoff automation, technical result, time, wait, first-pass outcomes, loops, and unavailable usage.

FACTORY-BOOTSTRAP began before this ledger existed. Its raw dispatch receipt in `work-items/FACTORY-BOOTSTRAP/bootstrap-dispatch.json` and real Foreman conversation are the bootstrap provenance. Do not fabricate earlier Triage or Spec reports to force the normal state machine. Complete its independent Review and Verify outside the new ledger with actual identities and commit-bound reports, then start DIAL-001 through this CLI once the scaffold is accepted. The bootstrap exception is limited to establishing the recorder itself.

The CLI is local coordination, not a permission system or external harness adapter. Git commits identify candidate code; agents still need to inspect that exact commit. User approval remains a human action. There is no scheduler, daemon, automatic restart, benchmark, scorer, or cost estimator.
