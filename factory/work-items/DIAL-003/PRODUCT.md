# DIAL-003 — single playback across ChatGPT threads (proposal)

## Problem and scope

Dial currently creates an independent audio element in each rendered ChatGPT thread. Two open players can therefore play at once. Within **one browser profile on one device**, this phase proposes one active Dial stream across concurrently open Dial instances. This scope is conditional on the actual ChatGPT host giving those instances a shared browser lock manager and a working message channel. Neither condition has been demonstrated yet. These documents are an approval proposal, not a claim that the feature works or authorization to ship it.

The proposed owner choices are: **Play in a second thread takes over** after the first player pauses; **Pause from either thread may stop the active Dial stream**. The owner should approve these exact choices and the same-profile/device limit before implementation. Separate browsers, profiles, devices, accounts, other audio apps, and background playback after a frame is destroyed are outside this phase. No account, persistent playback state, server coordinator, or deployment is proposed.

## Listener behavior

- Playback begins only on a deliberate Play click for a selected station. If another Dial player owns audio, a Play click shows “Switching playback…” while the old player is asked to pause. The new stream starts only after exclusive ownership is obtained. The old player then shows “Paused because Dial started in another thread.” A simultaneous pair of Play clicks may choose either winner, but must never leave two Dial streams audible.
- The local player keeps its Play/Pause control. When another thread reports active playback, the idle player also offers **Pause Dial in other thread** and identifies the remote station when its last report is fresh. The remote Pause request targets the current owner; it never starts audio or changes the idle player's selected station. Acknowledged Pause shows “Paused in another thread.”
- Remote status is a recent observation, not a durable live session. If it grows stale, show “Playback in another thread may have changed” and keep the remote Pause action available. If a Pause request cannot be acknowledged promptly, show “Could not confirm Pause; check the other thread.” Do not say the other stream stopped merely because a message was sent.
- If Play cannot obtain exclusive ownership within the bounded transfer wait, cancel that Play attempt and show “Could not switch playback; the other thread may still be playing. Try again.” Do not start audio speculatively. Pause or source selection in the requesting frame cancels its pending Play. If a local stream errors or is paused, its ownership is released after the audio is stopped.
- Closing or remounting an instance clears that frame's transient state. A new frame can discover a responsive active owner, but no resume/autoplay occurs on remount. A backgrounded owner may answer late; switching can time out rather than forcing it to stop. An unexpected frame teardown may stop its audio and release its browser lock; the actual host behavior is part of verification.
- Country discovery, station selection, local Play/Pause/resume, retry, and Radio Browser click reporting retain their DIAL-002 behavior. Switching station locally stops its current stream and requires another Play click. A new successful playback start reports a click as before; failed or canceled starts do not.

## Capability gate and non-goals

Before the full feature is built, run the smallest instrumented probe **inside two real Dial MCP App frames in separate ChatGPT threads** on the intended browser/profile/device. Record browser/version, date, iframe origin information available to the tester, whether both frames coexist, two-way message delivery, and whether an exclusive lock held in A prevents acquisition in B and vice versa. Test lock release after frame close/remount, delivery while the owner is backgrounded, and `audio.play()` following an awaited lock transfer under a user click. A successful local browser test or MCP Inspector test does not satisfy this gate. Record the actual source/resource versions and CSP used by the probe.

If the two frames do not share both communication and lock scope, or post-transfer user-activated playback fails, stop this design and return to Foreman/owner for a revised architecture or PARK decision. Do not silently add server coordination, identity, accounts, or an audio proxy. If the gate passes, complete the implementation and still require separate audible two-thread ChatGPT verification before accepting the feature. Host capability can change; the supported claim is limited to the tested environment and must be rechecked when relevant host/browser behavior changes.

## Acceptance contract

1. The actual ChatGPT two-frame capability probe records shared communication, exclusive-lock behavior, lock recovery, and post-transfer playback, or reports the criterion BLOCKED/FAIL without claiming feature support.
2. In the supported tested environment, a Play in another thread transfers ownership after the old stream stops. Rapid and simultaneous Play, Pause, selection, error, and remount interactions do not produce overlapping Dial audio.
3. The second thread can request Pause of the active stream. It displays confirmed versus unconfirmed outcomes honestly, and both frames display local and recently observed remote state without treating stale reports as live truth.
4. Missing coordination APIs, denied locks, unresponsive owners, aborted attempts, media rejection, and frame teardown have usable states. Play fails closed when it cannot establish exclusive ownership; a delayed event from an old attempt cannot restart audio.
5. Automated protocol/controller tests and delivered-resource checks pass. Separate timestamped **actual two-thread ChatGPT** evidence includes audible play, takeover, Pause from each thread, rapid actions, background/close/remount behavior, and the tested browser/resource versions. Inspector and unit tests alone cannot pass this criterion.

## Approval decision

Approval binds this revision's same-profile/device boundary, second-Play takeover, remote Pause, bounded fail-closed behavior, and the capability gate. A failed gate returns for a new decision; it does not grant an alternate architecture. No merge, publishing, or deployment is included.
