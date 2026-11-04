# DIAL-003 — Coordinate playback across threads

Owner request following DIAL-002 host QA: if Dial is opened in another thread, Play/Pause should coordinate so two things cannot play at the same time.

Desired outcome: a single active audio stream across supported Dial instances, with understandable controls from another thread. Starting another player must prevent ongoing overlapping audio.

This is an intake request, not an approved technical specification. Triage must investigate actual ChatGPT iframe/origin/lifecycle constraints before proposing an implementation. Do not assume cross-thread shared storage, BroadcastChannel, service workers, a background session or server identity is available. Determine the intended scope (same browser/device versus multiple devices) and whether Pause in an idle second instance should control the active first instance or only its own player. Prefer answering platform feasibility before asking the owner to decide implementation details.

Acceptance criteria in state.json are provisional intake criteria. Route through Triage and, if needed, approval-bound PRODUCT.md/TECH.md. Preserve existing country discovery and station-switching behavior. No automatic merge or deployment. No product implementation has started for this item.
