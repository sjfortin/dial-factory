# Temporary host-test endpoint

Owner said the previous HTTPS endpoint likely needed restarting. Foreman restarted the existing built Dial server with `npm start`, then downloaded the official Cloudflare cloudflared binary into /tmp and started a temporary Quick Tunnel with command approvals.

Endpoint: https://owner-integrity-mary-wilderness.trycloudflare.com/mcp

Actual public MCP Inspector tools/list completed with exit 0 and returned open_radio (radio-v3), find_stations_by_country (country-v1), and app-only report_station_click. This establishes endpoint/protocol reachability only; ChatGPT rendering and audible playback remain unobserved.

Local server session: 23177. Tunnel session: 83815. Binary: /tmp/dial-cloudflared. The endpoint is temporary and depends on both processes and this machine staying running. No permanent installation or production code changes were made.
