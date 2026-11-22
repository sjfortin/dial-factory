# Dial checkpoint — DIAL-012 ready for rollout approval

Updated 2026-11-23. Work branch `work/DIAL-012`; reviewed product candidate `c073716626a35d3db189bb814373afaa00864dd0`. Distinct Country and NTS views, Help, launch/search/pause tools, NTS archive search and HLS playback, and ownership-aware Media Session controls are implemented locally. Android is the selected phone test target; casting is deferred.

## Evidence and limits

Independent Review `run-c2cee7414103` ACCEPT. Independent Verify `run-0fec9b5003c6` ran 56/56 tests and 7/7 saved reviewer reproductions successfully. A fresh bounded NTS search returned 12 show/episode results; the returned Floating Points episode dated 21 September 2026 resolved to HLS on the approved SoundCloud media origin. A rerun local Chromium fixture passed manifest/media, time progression, Pause/resume and seek. Signed query values are not recorded. See DIAL-012 evidence/run-0fec9b5003c6 and canonical reports.

Actual ChatGPT archive audio, app-only _meta forwarding, MSE/CSP, prompt routing and same-browser cross-thread behavior remain unverified. Android Bluetooth output, background/lock-screen behavior and headset/notification controls also remain unverified. Overall Verify BLOCKED only for those missing host/device observations; DIAL-012 WAITING_FOR_HUMAN, resume VERIFYING.

## Next action

Request owner authorization to push/merge the reviewed DIAL-012 candidate and update the existing testing endpoint. Implementation approval was recorded previously; no DIAL-012 merge, push or deployment has occurred. Existing `dial-test` is still on the prior working player. Preserve every historical country URI alias when rolling out. After rollout, have owner select Refresh tools once and use new launch tools in a new conversation; known old UI addresses must still resolve.

Follow the focused host QA checklist in factory/work-items/DIAL-012/evidence/HOST-QA.md. Do not infer host or phone success from local Chromium. The owner already confirmed live NTS1/2 Play/Pause/Play-again and switching on the previous deployed version; that evidence remains intact.

## Recovery provenance

The November 17 Review turn hit a real usage limit but saved its complete two-finding REVISE report. On resume, that report was recorded honestly and a replacement Implement fixed ordinary direct/native resume position and retained-HLS fatal errors. A subsequent daemon restart lost a dispatched-but-not-started reviewer; its run was closed BLOCKED. Fresh replacement Review and Verify completed against c073716. Context loss, replacements, prior defects and unknown per-worker usage/cost remain recorded. No worker, tool result or approval was invented.
