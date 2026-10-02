# FACTORY-BOOTSTRAP

Objective: establish a real Foreman-operated factory before starting Dial.

Route: approved contract -> Sol Implement -> independent Astra Review and Luna Verify -> one revision -> owner pause/resume -> same Sol Implement -> same independent workers -> Foreman handoff.

Result: scaffold PASS on 3652c7e5958e8552892805996740b8d5e3e32760. Initial candidate 027fdad failed independent review and verification despite six passing tests. The replacement passed thirteen repository tests, six additional independent reviewer tests, and CLI PASS/FAIL/BLOCKED/retry/reapproval/recovery exercises.

Agents: /root/factory_implement (requested gpt-6-sol/high), /root/factory_review (gpt-6-astra/medium), /root/factory_verify (gpt-6-luna/medium). Worker context survived the pause; no replacement was needed.

Review findings: old evidence could survive a failed rerun; revisions could omit fresh Implement/Review; changed specs could bypass renewed approval; interrupted handoff writes could omit required artifacts. All four are resolved in the accepted candidate.

Human interventions: approval/model preference, pause, public-repository instruction, resume. No human implementation. One factory-required approval, four owner interactions recorded in metrics.

What worked: real separate contexts and models, independent behavioral failures, returning findings to Implement, durable checkpoints. What failed: initial test coverage missed invalidation/recovery; an initial long worker turn needed a progress checkpoint.

Metrics: first Review and Verify failed; two implementation attempts; one review-driven repair batch also incorporated concurrent Verify findings. Cost/tokens unavailable. Exact bootstrap intake-to-handoff time unavailable because intake preceded the recorder; metrics.json includes observed elapsed lower bound and the owner pause separately. DIAL-001 will use the actual ledger timestamps.

Remaining limit: dispatch packet mirrors are not automatically reconstructed after write failure; canonical run metadata remains. Role permissions are procedural. FI-001 regression coverage is implemented and independently checked.

Evidence and reports: ../../factory/work-items/FACTORY-BOOTSTRAP/. No merge or deployment. DIAL-001 is the next product work item.
