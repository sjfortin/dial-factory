# DIAL-005 — minimal inline player redesign

## Problem

The working player is visually a proof: fixed colors, loose spacing, and raw country rows take more attention than a small radio control should inside a ChatGPT thread. The owner requested a polished, compact interface and concrete options before implementation.

## Design decision

**Pending owner selection. No production implementation is authorized by this draft.** The interactive, non-production comparison is `design/player-directions.html`. Three directions share the same product behavior:

- **A · Studio (recommended):** neutral, compact station card with a distinct round Play/Pause action and understated status. Country rows use one selected treatment and a small amount of metadata.
- **B · Editorial:** warmer paper-like card and typographic station emphasis, with a visible text action. Country results read as a restrained list.
- **C · Slim:** shallow horizontal player strip and dense, clean station rows, suited to the narrowest conversations.

The mockup is illustrative: it does not stream audio or claim actual country results. Owner selection and any requested refinements must be incorporated into this document and `TECH.md` before approval. Exact document revision approval then gates Implement.

## Behavior and UX

- Show the current station name first and one obvious Play/Pause action with a clear accessible name; visible action text depends on the selected direction. The fixed player opens with Radio Paradise selected. The discovery player begins without a selection; Play stays disabled until a valid row is selected.
- Keep status text near the action and say what is known: ready/selected, acquiring ownership, connecting/buffering, confirmed playing, locally paused, paused by another thread, and error. A remote view says Dial **may** be playing elsewhere, including when information is stale. The remote Pause action appears only when current coordination exposes it. A pending remote Pause is not displayed as confirmed.
- A local Play request follows the existing same-browser/profile exclusive ownership flow. Taking over pauses the previous view. Pause in another thread retains its existing confirmation/outcome semantics. Visual changes must not promise cross-device, background, or always-on playback.
- Discovery shows at most the existing ten validated stations. Each row has a clear station name, restrained available metadata, keyboard-selectable control, and visible selected state. The selected station and playback control remain clear when rows fill the view. Preserve the existing summary, empty/provider/invalid-country messages, Radio Browser attribution, and click-reporting privacy notice.
- Fit at approximately 320px and 560px content widths with no horizontal overflow, clipped station names, overlapping controls, or hidden status. Respond to host light and dark appearance. Use opaque player surfaces that remain legible in either theme.
- Keep native buttons, visible focus indication, clear accessible names, readable text/contrast, and announced state updates. Do not convey playing, selected, remote, or error state by color alone. Do not autoplay.

## Edge cases

Long provider station names wrap or truncate only with full accessible text. Switching selection during buffering cancels the old attempt according to existing controller behavior. Stream/permission errors retain actionable messages and a retryable Play action. Rapid Play/Pause and stale asynchronous completions must never show a false playing state. A stale remote status must not assert active audio. Ten result rows remain usable without an internal scrolling region.

## Non-goals

No changes to playback coordination protocol, provider filtering, media origin policy, click reporting, persistence, diagnostics/probe, station artwork, favorites, volume, progress/time, track metadata, search, or deployment. No generated logo or unsupported media claim.

## Acceptance

1. The owner can compare concrete A/B/C directions at thread-like widths and selects a documented revision before build.
2. The chosen design preserves fixed and country-player behavior, takeover, remote Pause, and truthful local/remote/loading/error states.
3. Both delivered resources are consistent in light/dark themes, fit narrow widths, and expose accessible keyboard/focus/status/selection behavior.
4. Meaningful resource and interaction regressions pass; independent Review and Verify assess the exact implementation candidate. Actual ChatGPT host visual QA at narrow and ordinary thread widths is recorded as observed evidence, with any unavailable check marked BLOCKED rather than assumed passing.
