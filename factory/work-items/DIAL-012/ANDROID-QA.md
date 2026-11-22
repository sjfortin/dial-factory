# Android capability test target

Owner selected Android on 2026-11-17. This resolves the phone-platform question in PRODUCT.md/TECH.md; actual phone model, Android version and ChatGPT app version will be recorded during testing. No phone result has been observed yet.

After an approved implementation and rollout, check explicit foreground playback, Bluetooth output on the selected headset/speaker, background continuation, screen-lock continuation, notification/lock-screen Play and Pause, Bluetooth media buttons, return-to-thread recovery, and ownership transfer between Dial views. Record supported, failed and untested checks separately. Other applications' media controls must remain unaffected. A phone's OS output route is separate from casting; casting remains deferred.

Primary capability references: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API and https://learn.chatgpt.com/docs/plugins . These describe a candidate mechanism and general mobile plugin availability, not actual ChatGPT-host Media Session forwarding or background support.
