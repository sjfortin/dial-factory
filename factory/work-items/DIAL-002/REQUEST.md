# DIAL-002 — next-phase proposal

Owner approved preparing the DIAL-001 PR and a bounded next-phase proposal. This does not approve implementation of a specification not yet written.

Proposed objective: find stations for a country and play a selected station in the ChatGPT MCP Apps UI. Draft criteria in state.json are an intake proposal; PRODUCT.md and TECH.md should turn them into a reviewable contract before BUILDING.

Non-goals: favorites, database, accounts, personalized recommendations, name/genre search, station directory administration, NTS integration, production deployment, and background playback guarantees. No automatic public posts or merge. Controlled host failure verification deferred from DIAL-001 remains in docs/backlog.md; do not silently rewrite its waiver. Routine new provider/input errors still need understandable outcomes in this proposal.

Baseline: DIAL-001 accepted product ac6ae029 with final audit at d49be43. Owner manually confirmed host rendering and audible Play/Pause/resume. DIAL-001 completed with one unverified host error-state criterion explicitly waived. PR https://github.com/sjfortin/dial-factory/pull/1 targets current default factory/bootstrap and is not merged. DIAL-002 is stacked on that pending branch for planning only. Implementation should wait for approved spec and resolution of the integration baseline.

Triage should inspect current source and primary provider/MCP documentation. Spec should choose the smallest feasible discovery/selection route and explain dynamic media CSP treatment without claiming arbitrary stream support. Foreman owns all questions and approval records. No worker should ask the owner directly or begin production implementation.

Factory roles are real collaboration workers. Triage Luna/medium, Spec Sol/high, later Implement Sol/medium, independent Review Astra/medium, Verify Luna/medium. Costs/tokens unavailable. Preserve structured reports/evidence and use the CLI for lifecycle recording; it cannot spawn workers itself.
