# DIAL-001 triage source notes

Read-only triage on 2026-10-02. Sources are public documentation; no stream endpoints were contacted and no product code was run.

- OpenAI, [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui): ChatGPT runs MCP Apps components in an iframe; new UI should use `_meta.ui.resourceUri`, the `ui/*` bridge, and `text/html;profile=mcp-app`. CSP metadata declares `connectDomains`, `resourceDomains`, and `frameDomains`; external stream/media behavior needs host verification.
- OpenAI, [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui#picture-in-picture): describes ChatGPT PiP as a display mode for ongoing activity and calls out live sessions as an example. This establishes host-level feasibility as a candidate; it does not establish that this specific host/account supports it or that browser-native audio PiP applies.
- OpenAI, [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui#manage-state): separates ephemeral per-UI state from durable cross-session state. The bounded proof can keep player state in the UI instance and document that remount/reload loses it.
- MCP TypeScript SDK, [Server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md): describes `McpServer`, Streamable HTTP for remote servers, and stdio for local process-spawned integrations. The packet's remote ChatGPT target implies Streamable HTTP for the proof endpoint; MCP Inspector can use stdio for a local smoke check or HTTP against the same endpoint.
- MCP Inspector, [CLI README](https://github.com/modelcontextprotocol/inspector/blob/main/clients/cli/README.md): documents `npx @modelcontextprotocol/inspector --cli <server-url> --transport http --method tools/list` for Streamable HTTP and tool-call/resource probes.
- MCP, [Streamable HTTP transport specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/basic/transports/streamable-http.mdx): specifies one MCP HTTP endpoint, POST requests, and JSON or request-scoped SSE responses. It is transport for MCP messages; the audio stream itself is a separate direct media request from the UI.
- MDN, [Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): audible playback may be blocked without user interaction, and `play()`/autoplay failures need a clean fallback. Keep audio start directly in the Play gesture and surface rejected play promises/media errors.

## Environment observations

- `git status --short --branch` reported `## work/DIAL-001` with no changes at triage start.
- `rg --files` showed only factory/docs files and no product server, UI, package manifest, or implementation under the current work item.
- CUA browser inventory returned `apps: []`, `browsers: []`; the request also records no ChatGPT MCP test connection and no public HTTPS development endpoint.
- Therefore Inspector/local checks and source inspection can be completed by the Implement/Verify roles, but ChatGPT iframe rendering, actual audible playback, CSP/media behavior, and host PiP cannot be verified from this environment until a dev HTTPS endpoint and connected ChatGPT test host are available.
