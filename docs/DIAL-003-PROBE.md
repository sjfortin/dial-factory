# DIAL-003 actual ChatGPT frame probe

This is a diagnostic build, not the single-playback feature. The only new entry point is MCP tool `open_capability_probe`, which delivers `ui://dial/capability-probe-v2.html`. The script is `dist/probe.js` from `src/probe.ts`. It uses `dial-probe-channel-v2` and exclusive lock `dial-playback-v1`, with Radio Paradise at `https://stream.radioparadise.com/mp3-128`. The delivered CSP has `connectDomains: []` and only `https://stream.radioparadise.com` in `resourceDomains`. Existing `open_radio` and `find_stations_by_country` resources and behavior are unchanged.

After building and making the authorized test MCP endpoint available to ChatGPT, refresh the Dial connection. In the intended browser and profile, open `open_capability_probe` in **two separate ChatGPT threads**. Keep both frames open. Each frame displays its own short ID, observed peer ID, origin, browser agent, resource version, UTC event times, and copyable JSON. Save both logs together with the browser/version and test date. Do not use a local harness or Inspector result as a substitute.

1. In A and B, click **Send nonce**. Each must show a nonce roundtrip from the other frame.
2. Click **Hold exclusive lock** in A; click **Check lock contention** in B. B must show blocked. Release A, check B sees available. Repeat with B holding and A blocked.
3. With A holding, click **Click to transfer and play radio** in B. Confirm A records pause/release before B records lock acquisition and `post-await-play-resolved`. Mark **I heard audio** or **I heard no audio** in B. Repeat in reverse.
4. Repeat the transfer with the holder's thread backgrounded. Look for message receipt and any transfer timeout; record actual result.
5. Hold the lock in A, close A's frame/thread, check B sees the lock available, reopen A and send nonces again. Record both logs and whether playback stopped. A closed frame's log must be copied before closing; B's log confirms recovery.

A `play()` resolution alone does not establish audible playback. A lock appearing available when another frame is known to hold it means the scopes are not shared. A missing API, missing nonce roundtrip, nonexclusive lock, failed recovery, or rejected post-transfer play fails the gate. Stop the design and return the observations to Foreman; no server coordination or policy widening is authorized by this probe. The on-screen summary is per frame and remains pending until matching observations are collected in both real frames.
