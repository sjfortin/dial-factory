# Dial Factory v0 — approved bootstrap contract

Human approved the Foreman's proposal in this conversation, then requested appropriate per-worker models to reduce cost for bounded work. Factory is the primary product. Do not implement Dial until this scaffold passes independent review and verification. DIAL-001 is the first product work item, separate from FACTORY-BOOTSTRAP.

## Execution

Foreman runs through the current harness's actual collaboration tools. Real distinct workers do Triage, Spec, Implement, Review, Verify. Use fresh conversation context, role-appropriate packets, and followup_task for revisions. Do not simulate worker reports. Python cannot invoke the harness's collaboration tools: the adapter must say so. No daemon, scheduler, autonomous restart recovery, or external harness adapter is required.

Foreman manages records/routing/questions, never becomes default production implementer, never approves its implementation, merges or deploys. Workers escalate product ambiguity through Foreman. Only Implement edits production code. Review and Verify have separate identities from Implement; review does not edit code. Shared tools/files mean these are procedural boundaries, not security isolation. Git branches/worktrees separate work, not permissions.

## Minimal scaffold

Use Python standard library for factory/factory.py with executable validation and meaningful tests. Version-control root AGENTS.md, factory/factory.json, six factory/agents/<role>/agent.md contracts, factory/adapters/current-harness.md, schema contracts, small relevant factory knowledge, capability documentation, improvement-proposal area, work records, journal/public notes. Avoid empty placeholder frameworks or unrelated product code.

Factory CLI creates work items, prepares packets, records real dispatch/run metadata and reports, records interventions/approvals/spec skips, advances validated state, derives metrics, and generates handoff/journal/public-note artifacts. Foreman is the single lifecycle writer. Keep commands simple and documented. Structured reports can be JSON with human-readable rendering. Preserve specified report fields.

States: INTAKE, TRIAGE, WAITING_FOR_HUMAN, PLANNING, WAITING_FOR_SPEC_APPROVAL, BUILDING, REVIEWING, VERIFYING, READY_FOR_HANDOFF, COMPLETE, PARKED, CANCELLED. Separate lifecycle state from final_result PASS/FAIL/BLOCKED. An honestly blocked/failed investigation can be handed off and completed with explanatory evidence; do not mislabel it as passed. Record resume stage for human waits.

Triage fields: work_item, scope, relevant_code, evidence, complexity, risks, open_questions, recommendation IMPLEMENT/SPEC/HUMAN_INPUT/PARK.
Spec: PRODUCT.md (problem, behavior, non-goals, UX, edge cases, acceptance) and TECH.md (architecture, components/APIs/data/dependencies, constraints, tests/verification/failure/rollback) when needed; approval binds exact content revision. Record every skipped Spec and reason.
Review fields: requirements, architecture, correctness, tests, security, complexity, findings, recommendation ACCEPT/REVISE/HUMAN_DECISION.
Verify: per acceptance criterion method, result PASS/FAIL/BLOCKED, evidence; overall PASS/FAIL/BLOCKED. All required criteria accounted for. Missing evidence cannot pass. Behavior, not implementer assertions.
Implement: change summary, decisions, candidate commit, tests and actual evidence, ambiguities/blockers.

Enforce: approval (or justified skip) before build; independent reviewer identity; review and verification bound to candidate commit; changes invalidate old acceptance; complete evidence before passing handoff; failure routes back through Implement and Review, not straight to Verify. Gate on latest attempt, not any historic pass. Preserve identity, every run/attempt and loop. Record dispatch before work; unknown worker/model accounting stays explicitly unknown. Malformed or unsafe paths rejected. Consistent on-disk state and recovery are required, but this is not an adversarial security boundary.

## Model policy (actual allowed harness IDs)

Foreman: inherited root model (cannot switch itself). Triage: gpt-6-luna / medium. Spec: gpt-6-sol / high. Implement: gpt-6-sol / high for bootstrap; medium for routine bounded work. Review: gpt-6-astra / medium for independent judgment. Verify: gpt-6-luna / medium for deterministic acceptance checks. Escalate Luna to Sol for ambiguous evidence or repeated reasoning failures; record why and replacement agent/context handoff. Do not automatically retry indefinitely, promote for missing access, or silently fall back to another model. Available IDs also include gpt-5.6-sol and gpt-5.6-terra; not initially used. No gpt-6.1-sol is exposed in this harness even if public docs mention it.

Store requested model/reasoning, reported model if independently exposed (otherwise null), selection reason, harness, agent identity, start/end/duration, result, retries, interventions, input/output tokens and cost nullable with unavailable reason. Do not claim API list prices equal ChatGPT billing; no invented cost totals. Preserve useful sanitized logs, not private transcripts/secrets.

Metrics from DIAL-001: handoff without human implementation (bool), intervention count, intake-to-handoff cycle time, wait time, first implementation review success, first implementation verification success, review->implement and verify->implement loop counts, cost/usage nullable. Distinguish automation from technical success and report sample size. Record every intervention: work_item, stage, reason, question, human_response, could_factory_have_avoided_this, possible_improvement.

Each terminal handoff includes evidence, docs/factory-journal/<id>.md and work-item PUBLIC_NOTES.md. Journal covers objective/route/agents/interventions/findings/result/cost/time/what failed/worked/improvements. Public notes are sanitized for human review, never published automatically. Factory improvements are reviewable proposals, never silent rule changes. Scorers, benchmarks, Factory Improver, dashboard and alternate harness adapters are deferred.

## Capability evidence from live probes

Separate /root/capability_probe spawned with fork_turns=none and resumed with remembered token. Four active slots include root. Agents share filesystem/tools. Native browser discovery returned no browsers/apps. Shell works; Git 2.55.0, Node 24.21.0, Python 3.14.7, Codex CLI 0.155.1 authenticated via ChatGPT. CLI exec/resume/json/output-schema/worktree options inspected, not runtime tested. GitHub connector authenticated; repo search returned no Dial repo; remote writes not tested or authorized. No per-worker cost/token export through collaboration tools. Do not rely on durable agent-tree restart; reconstruct replacement workers from saved packets when needed, record context loss.

## Bootstrap acceptance

Actual Implement creates scaffold; different Review and Verify agents review/run it. Tests exercise illegal transitions, missing/spec-changed approvals, self-review, stale commit evidence, missing/failing verification, revisions, state recovery, malformed reports and metrics. Synthetic fixtures are marked and never represented as worker output. No external publishing/merging/deployment. Proposed repo is /home/sam/Work/dial; local commits allowed to identify review candidates.

## DIAL-001 intake (do not execute before bootstrap passes)

Title: Prove live internet-radio playback inside ChatGPT MCP Apps UI.
Objective: Determine whether Dial can reliably play an HTTPS internet-radio stream from an MCP Apps UI inside ChatGPT.
Acceptance criteria: (1) TypeScript MCP server runs; (2) MCP Inspector connects successfully; (3) test tool returns one known station; (4) UI resource renders inside ChatGPT; (5) Play initiates audio; (6) Pause stops audio; (7) playback resumes; (8) failure renders clean error state; (9) CSP/network behavior documented; (10) persistence behavior documented; (11) PiP feasibility investigated; (12) verification evidence captured.
Non-goals: search, favorites, database, accounts, NTS integration, recommendations, production deployment.
Expected route: Intake -> Triage -> Implement -> Review -> Verify -> Foreman -> Human; Foreman decides after Triage whether Spec is needed. No browser connection currently; do not invent ChatGPT/audio evidence. Verify available checks, then request minimum needed human verification and log intervention. Investigated unavailability is a defensible BLOCKED outcome.

## Human approval record

Question: Approve scaffold scope: build and independently check factory, then admit DIAL-001 through Triage?
Response: "yes sounds good. approved. i want each subagent to have appropriate models working too so that I can have lower cost models working for low reasoning workers"
This is necessary approval, not avoidable implementation work.
