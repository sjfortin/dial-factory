# Restored stable Tailscale endpoint

Owner requested using the previous Tailscale URL as a more permanent endpoint. Read-only inspection showed HTTPS port 443 configured tailnet-only with root proxy http://127.0.0.1:4312; no listener existed on port 4312.

With command approval, Foreman ran:

tailscale funnel --bg --yes http://127.0.0.1:8787

CLI confirmed public internet availability and background Funnel. Actual MCP Inspector tools/list against https://macbook-air.tail10dbb3.ts.net/mcp exited 0 and returned open_radio (radio-v3), find_stations_by_country (country-v1), and app-only report_station_click.

Funnel configuration is persistent; the hostname is reused. Dial itself is still a manually started process, session 23177, and this machine must remain awake, online and running Dial. No automatic server startup has been configured. This is protocol reachability evidence, not ChatGPT rendering or audible playback evidence.

Previous route: / -> http://127.0.0.1:4312, tailnet only. Restored route: / -> http://127.0.0.1:8787, public Funnel. Disable Funnel with tailscale funnel --https=443 off when appropriate; do not silently change it during later verification.
