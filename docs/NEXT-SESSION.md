# Dial checkpoint — DIAL-012 deployed; host and Android QA next

Updated 2026-11-23. Work branch `work/DIAL-012`; reviewed product candidate `c073716626a35d3db189bb814373afaa00864dd0`. Distinct Country and NTS views, Help, launch/search/pause tools, NTS archive search and HLS playback, and ownership-aware Media Session controls are implemented locally. Android is the selected phone test target; casting is deferred.

## Evidence and limits

Independent Review `run-c2cee7414103` ACCEPT. Independent Verify `run-0fec9b5003c6` ran 56/56 tests and 7/7 saved reviewer reproductions successfully. A fresh bounded NTS search returned 12 show/episode results; the returned Floating Points episode dated 21 September 2026 resolved to HLS on the approved SoundCloud media origin. A rerun local Chromium fixture passed manifest/media, time progression, Pause/resume and seek. Signed query values are not recorded. See DIAL-012 evidence/run-0fec9b5003c6 and canonical reports.

Actual ChatGPT archive audio, app-only _meta forwarding, MSE/CSP, prompt routing and same-browser cross-thread behavior remain unverified. Android Bluetooth output, background/lock-screen behavior and headset/notification controls also remain unverified. Overall Verify BLOCKED only for those missing host/device observations; DIAL-012 WAITING_FOR_HUMAN, resume VERIFYING.

## Rollout and next action

Owner approved rollout. PR10 merged at `bb53968cb2be4a69877fcd426d06d204b9610764`; main built and existing dial-test restarted. Public checks passed for all new tools, expected launch modes, current and historical UI resources, 12 archive results and selected-episode HLS resolution with signed URL isolated in app-only metadata. See evidence/rollout.md and rollout-check.json. This proves public delivery, not actual ChatGPT or Android capabilities.

Have owner open Dial's connection and select **Refresh tools**, then use a new conversation. Try “Dial, open country radio”, “Dial, open NTS”, “Dial, search NTS archives for Floating Points”, and “Dial, pause”. Archive playback starts with an explicit Play press in the app. Follow the focused host QA checklist in evidence/HOST-QA.md, including Pause/resume/seek, source switches, acknowledged cross-thread pause and Android Bluetooth/lock-screen/headset behavior. Retain the original missing host/device subchecks as BLOCKED until actual results arrive.

## Recovery provenance

The November 17 Review turn hit a real usage limit but saved its complete two-finding REVISE report. On resume, that report was recorded honestly and a replacement Implement fixed ordinary direct/native resume position and retained-HLS fatal errors. A subsequent daemon restart lost a dispatched-but-not-started reviewer; its run was closed BLOCKED. Fresh replacement Review and Verify completed against c073716. Context loss, replacements, prior defects and unknown per-worker usage/cost remain recorded. No worker, tool result or approval was invented.
