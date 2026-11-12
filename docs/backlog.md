# Dial backlog

## Verify the rendered stream failure and recovery in ChatGPT

Deferred explicitly by the owner when closing DIAL-001. The controlled host error-state check was waived for that experiment; it was not observed passing.

Local controller tests already cover rejected play and retained-media-error recovery. A later bounded factory work item should induce an actual stream failure in the ChatGPT player, observe a readable rendered error, restore the stream, and confirm audible recovery. Assign an ID at intake. Do not assume the error state is broken; its host behavior remains unverified.

## DIAL-003 — Coordinate playback across chat threads

Owner requested this next phase after DIAL-002 host QA: prevent simultaneous streams when Dial is opened in multiple ChatGPT threads, and make Play/Pause work coherently across those instances. Intake is recorded in factory/work-items/DIAL-003. Triage must establish host feasibility and scope before an approved design or implementation.

## Player visual redesign — next after cross-thread playback

Owner requested a more attractive, clean and minimal player that looks excellent within a ChatGPT thread. Prepare a concrete visual proposal before implementation: compact inline footprint, strong station-name hierarchy, clear primary Play/Pause control, restrained color and ornament, comfortable spacing, concise station selection, and coherent loading, empty, error, local/remote playback states. Include light/dark themes and narrow thread widths. Avoid exposing internal coordination diagnostics in the normal player. Preserve keyboard/focus usability and the approved playback behavior. Compare visual options in actual thread-sized mockups, then route the selected design through implementation and independent Review/Verify. This request is recorded; no redesign implementation has started.

## Globe country picker — owner-requested stretch goal (2026-11-12)

After DIAL-008 truthful More behavior and DIAL-009 coverage/NTS work, explore a globe-position country selector for the ChatGPT desktop app. Keep the default player clean, minimal and compact. Prepare a concrete visual/interaction proposal before implementation, including a simple accessible country-list alternative, narrow card layout, keyboard use and clear selection without automatic playback. A globe is a stretch exploration, not approval of an unseen design or a dependency for NTS support. Owner requested more stations per existing country, expanded country coverage and NTS Radio as the nearer priorities.
