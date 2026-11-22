# Pending DIAL-012 host and Android QA

This is a plan, not observed host evidence. Product candidate: c073716626a35d3db189bb814373afaa00864dd0. Run only after an owner-authorized testing rollout and connection Refresh tools.

1. In a fresh conversation with Dial enabled, ask “Dial, open country radio” and “Dial, open NTS”. Confirm the correct distinct default views, Help, keyboard/touch controls, and narrow/light/dark presentation. Check the earlier country entry point still opens.
2. In NTS, test NTS1 and NTS2 Play, Pause and Play again. View-only navigation should preserve playback; selecting another source should stop the old audio. Check source attribution remains correct.
3. Ask “Dial, search NTS archives for Floating Points”. Select a returned public episode (fresh verification used 21 September 2026), explicitly Play, confirm audible audio, Pause/silence, resume, and seek where enabled. Confirm title/position. A different source or unavailable format must show a clear state and official episode link. Do not paste signed media query values into feedback/logs.
4. Test remote Pause from another thread in the same browser profile/device, confirm the actual acknowledgement and silence, then resume the selected archive at its position. Reopening an old pause card must not stop a newly started stream. Cross-device control is not promised.
5. Test error/retry, fast source changes and a deliberately unsupported archive where practical. Record visible outcomes and distinguish unavailable instrumentation from observed failures.
6. On the owner's Android phone, record phone/Android/ChatGPT versions; start playback on the phone, select the normal Bluetooth output, and observe audio, background continuation, screen lock, notification/lock-screen Play/Pause, headset media buttons and return-to-thread recovery. These are measured capabilities, not guaranteed host features. Test that stale threads do not take over or remove another player's media controls.

For every observation record date, tool/view, station or episode, device/profile and result. ChatGPT forwarding, CSP and audio are separate from direct HTTP/local fixture evidence. No global account or cross-device guarantee is implied.
