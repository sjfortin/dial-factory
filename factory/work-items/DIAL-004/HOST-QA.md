# Regular-player two-thread QA

Candidate: d196b7edfbbd89190dee72d81dfaa640177fd47a. Expected resources: radio-v7 and country-v5. Scope: one browser profile on one device. This tests the regular player, not open_capability_probe.

Refresh the Dial connection to https://macbook-air.tail10dbb3.ts.net/mcp and start two new ChatGPT threads/tabs. In each select Dial and ask for stations in FR or GB; select a supported station. You can also use the fixed Radio Paradise player in one tab to check both entry points.

1. In A press Play and confirm audible sound. In B press Play: A must stop before B becomes audible. Repeat B to A. Record station names, country/tool and results.
2. In the idle tab use **Pause Dial in other thread**. The active tab must become silent and show stopped/paused state. Repeat in reverse. Confirm success or unconfirmed/error text matches actual sound.
3. Try rapid Play/Pause, station selection and takeover in both tabs. Canceled/old attempts must not restart sound or cancel a newer valid playback. No persistent overlapping streams should occur.
4. While A is playing, put A in the background and take over from B. Record whether takeover succeeds or gives a bounded retryable message while B remains silent.
5. Play A, then close its ChatGPT tab/frame. B must recover and be able to play. Reopen A and confirm normal controls work again without autoplay. Repeat direction if feasible. This close/remount check was not established by the earlier capability probe.
6. Confirm a fresh station result and retry still work. Record any dead provider streams separately from coordination failures.

Reply with browser/version, date, station names, which tests passed/failed, any error text and whether overlapping audio was heard. No hidden browser diagnostics are required. These are actual owner observations; local tests and Inspector packaging checks cannot substitute for them. Visual redesign is planned separately after coordination verification.
