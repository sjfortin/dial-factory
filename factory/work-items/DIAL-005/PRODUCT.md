# DIAL-005 — minimal inline player redesign

## Problem

The working player is visually a proof: fixed colors, loose spacing, and raw country rows take more attention than a small radio control should inside a ChatGPT thread. The owner requested a polished, compact interface and concrete options before implementation.

## Selected design

The owner selected **A · Studio** from `design/player-directions.html`. This selection fixes the visual direction, but **the exact revision of this specification still requires approval before Implement edits production files**. The comparison is an illustrative, non-production mockup: it does not stream audio or claim actual country results.

Studio uses one compact, neutral, opaque card. A small “Dial · Live radio” label leads into a prominent station name and quiet secondary descriptor. A distinct round Play/Pause icon button sits beside the title, with a clear accessible action name. The truthful playback status stays directly below that row; remote status and its secondary Pause action remain nearby without competing with the main control. In the country resource only, a subtle divider leads into compact station rows. The chosen row is marked by both text weight and a check, and row selection does not start audio. The fixed Radio Paradise resource shows the player without country rows. The design uses restrained green for the primary action and active state, neutral surfaces, and corresponding light/dark values. No artwork or decorative waveform is needed.

## Behavior and UX

- Show the current station name first and one obvious Studio round Play/Pause control with a clear accessible name. The fixed player opens with Radio Paradise selected. The discovery player begins without a selection; Play stays disabled until a valid row is selected. Once selected, that row's name becomes the player title.
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

1. The Studio direction selected from concrete A/B/C mockups is implemented after exact-revision spec approval, with the compact card and integrated country-row treatment described above.
2. Studio preserves fixed and country-player behavior, takeover, remote Pause, and truthful local/remote/loading/error states.
3. Both delivered resources are consistent in light/dark themes, fit narrow widths, and expose accessible keyboard/focus/status/selection behavior.
4. Meaningful resource and interaction regressions pass; independent Review and Verify assess the exact implementation candidate. Actual ChatGPT host visual QA at narrow and ordinary thread widths is recorded as observed evidence, with any unavailable check marked BLOCKED rather than assumed passing.
