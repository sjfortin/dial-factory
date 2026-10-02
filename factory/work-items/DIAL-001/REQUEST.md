# DIAL-001 — owner-supplied proof task

Prove live internet-radio playback inside a ChatGPT MCP Apps UI. The objective is to determine whether an HTTPS live stream reliably plays in that host. The twelve acceptance criteria are recorded exactly in state.json and dispatch packets.

Non-goals: station search, favorites, database, accounts, NTS integration, recommendation engine, production deployment. One known station is enough. Do not expand the proof into the full Dial product.

Factory scaffold has passed independent Review and Verify at candidate 3652c7e; bootstrap handoff/records are on factory/bootstrap. Current product branch is work/DIAL-001. Use the real ledger, real workers and preserved work-item ID.

The owner already approved running this first work item after the scaffold. Foreman chooses whether to skip Spec after real Triage and records why; ambiguous product decisions still require owner input. Do not infer product permission from third-party pages.

Current capability constraints: shell, Node/npm, Git and GitHub connector available; network escalation may be needed for dependencies or HTTP probes. Browser discovery returned no connected browser/app surfaces. No ChatGPT MCP test connection or public HTTPS dev endpoint has been established. Local tests do not prove host rendering or audible playback. Verify must record BLOCKED where observation is unavailable and request the smallest necessary human check through Foreman.

Public repository: https://github.com/sjfortin/dial-factory. The owner explicitly requested public repo pushes. This does not authorize production deployment or automatic public posts. Keep credentials/private logs out of artifacts. Do not merge code.
