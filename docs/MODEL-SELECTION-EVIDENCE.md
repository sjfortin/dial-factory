# Initial worker model selection

Owner requested appropriate per-worker models to reduce cost on bounded work. These are starting hypotheses to measure, not proven optimal assignments.

| Role | Requested model | Reasoning | Purpose |
| --- | --- | --- | --- |
| Foreman | inherited current root | inherited | Route work and preserve decisions; cannot switch this running root through spawn tools. |
| Triage | gpt-6-luna | medium | Bounded investigation with structured evidence. |
| Spec | gpt-6-sol | high | Resolve architecture and produce a reviewable contract. |
| Implement | gpt-6-sol | medium; high for bootstrap | Balance implementation capability and cost; bootstrap state gates need extra reasoning. |
| Review | gpt-6-astra | medium | Independent correctness and requirements judgment. |
| Verify | gpt-6-luna | medium | Execute concrete checks, capture evidence, report failures and access blockers. |

The current harness explicitly permits these IDs and per-child reasoning overrides with fresh context. Public documentation may list additional models; that does not make them callable here. Requested settings are observable at dispatch. A successful spawn is not independent attestation of the backend model version or its billed cost. Store reported_model as null unless runtime metadata actually supplies it.

When a worker cannot resolve ambiguous evidence, Foreman may select Sol or Astra as needed and record the reason. Missing browser access, credentials, or network access is not fixed by spending on a larger model. If a model change needs a new worker, record replacement identity and context handoff; never pretend the earlier worker changed models in place.

Sources inspected during bootstrap:

- [Official model selection](https://developers.openai.com/api/docs/guides/model-selection): Luna for scoped tasks/triage; Astra for demanding analysis. Public Sol version guidance differs from the exact Sol ID exposed in this harness.
- [GPT-6 Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna): focused workloads, medium reasoning supported, published API token pricing. API pricing is not evidence of this ChatGPT session's bill.

Per-run token/cost telemetry is currently unavailable through collaboration tools. Record null values and the reason, never zero or invented savings. Compare quality, rework and cycle time now; measure dollar savings only when reliable usage becomes available.
