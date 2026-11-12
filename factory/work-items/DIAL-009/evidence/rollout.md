# Owner-authorized coverage rollout — 2026-11-12

Owner answered “approved” to pushing/merging candidate and updating the existing testing endpoint for QA. PR7 https://github.com/sjfortin/dial-factory/pull/7 merged at c93da8272d7361bc6d21ce00f08bb1a6a5da3a20, containing reviewed product candidate d4da1f9d1c9bb4c509bd35789fcb676607c3fbde and recorded evidence. Local main fast-forwarded and npm run build passed.

No prior server was listening on8787. Initial systemd-run attempt failed because /usr/bin/node does not exist; corrected to actual installed Node /home/sam/.config/nvm/versions/node/v24.21.0/bin/node. Transient user unit dial-test.service started successfully, PID331213, serving127.0.0.1:8787. Existing Tailscale Funnel unchanged: https://macbook-air.tail10dbb3.ts.net/mcp. Transient unit is not configured for reboot auto-start; hosting/reliability phase remains separate.

Public MCP SDK checks at2026-11-12T08:05:46Z connected successfully, listed tools and read country-v12 resource. Delivered HTML contains country picker, NTS1/2 and Retry. Real country lookups: US11 choices/statusok, AU1/statusok, SE0/no_supported_stations; all scans complete. See rollout-check.json. These checks prove public protocol/catalog/resource delivery, not actual ChatGPT rendered layout, CSP/audio or playback continuity.

DIAL-009 remains WAITING_FOR_HUMAN for hostQA. NTS remains link-only, not accepted in-app playback. No human verification result was invented.
