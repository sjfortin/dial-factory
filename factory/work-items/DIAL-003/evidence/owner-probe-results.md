# Owner-reported ChatGPT capability probe results

The owner supplied paired capability-probe-v2 JSON logs for Chrome 156 on macOS 10.15.7, both showing the same `codex-sandbox://mcp-app-...web-sandbox.oaiusercontent.com` origin and app resource. The frames were instance `39c8efc1-2e6f-43d6-b6ad-f160dd00c8c7` and `90c093ab-61ae-4729-9033-156f756ee00b`. Test date by event timestamps: 2026-11-05 UTC.

## Observed

- Both frames report `BroadcastChannel` and `navigator.locks` available.
- Nonce round trips passed in both directions several times, including 1.8–16.5 ms reported elapsed time.
- Instance `39c8efc1` held `dial-playback-v1` from 22:57:20.516Z until its user release at 22:57:55.855Z. During that interval instance `90c093ab` ran contention check at 22:57:31.173Z and recorded `acquired: false`, peer `39c8efc1`.
- During a second lock-hold interval, `90c093ab` recorded another `acquired: false` contention check against peer `39c8efc1` at 22:59:21.390Z. Its own log marks self-contention as skipped while it itself held a lock, correctly avoiding false shared-proof.
- A transfer request made while `39c8efc1` held the lock was received by that frame; it recorded `stopped-and-released`, then sent the transfer acknowledgment and recorded lock release. The requesting frame subsequently recorded lock acquisition, `play()` call and resolution.
- Transfer was exercised in both directions: `90c093ab` transferred to `39c8efc1` at 23:00:03Z; `39c8efc1` later transferred to `90c093ab` at 23:00:19Z. Paired event order records prior-owner release/acknowledgment before new-owner lock acquisition and post-await `play()`.
- Instance `39c8efc1` explicitly marked `heard: true, playback: true` at 22:59:03.519Z. Instance `90c093ab` later marked `heard: true, playback: false` at 22:58:57.699Z, so that second audible annotation is not tied to a currently-playing state in its log. Do not count it as a second successful audible playback observation.
- The logs show several visibility changes. At 23:00:16Z `39c8efc1` became hidden; it received a transfer request at 23:00:19.565Z, then paused/released and acknowledged it. This is evidence of one request being handled across a hidden interval, but the logs do not label or fully characterize a controlled background-delivery test.

## Remaining gap

Neither log records closing a lock-holding frame/thread, reopening it, and confirming the peer sees lock release and can recover. The approved gate explicitly calls for close/remount recovery. Ask owner to hold the lock in one frame, close that frame/thread, verify lock becomes available in its peer, reopen the frame, and confirm nonce messaging works again. Save the resulting peer log/event. The probe is a feasibility diagnostic; this evidence does not implement the full product behavior for normal player instances.

Source: paired JSON pasted by owner in the conversation on 2026-11-06; only the observations summarized above are asserted. No screenshot or machine-captured recording was provided.
