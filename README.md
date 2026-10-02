# Dial one-station MCP Apps proof

This is a bounded test of live HTTPS radio in a ChatGPT MCP Apps iframe. The only tool, `open_radio`, returns Radio Paradise's 128 kbps MP3 stream and an inline Play/Pause player. Playback starts on a user click. There is no station search, account, database, or deployment setup.

## Run and inspect locally

Requires Node 20 or newer. Run `npm ci`, `npm test`, then `npm start`. The default MCP endpoint is `http://127.0.0.1:8787/mcp`; `PORT` and `HOST` can be set for local testing. In a second terminal:

```sh
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/list
npx --yes @modelcontextprotocol/inspector --cli http://127.0.0.1:8787/mcp --transport http --method tools/call --tool-name open_radio
```

The resource URI is `ui://dial/radio-v2.html` with MIME type `text/html;profile=mcp-app`. The tool returns the station in `structuredContent`; the HTML resource embeds the browser bundle and initializes the MCP Apps host bridge. The tests exercise the HTTP tool/resource path and player state transitions with an audio double. They cannot establish that sound was heard.

## Network, CSP, and state

The `<audio>` element requests `https://stream.radioparadise.com/mp3-128` directly from the iframe. The server does not proxy audio. The resource declares `resourceDomains: ["https://stream.radioparadise.com"]`; it makes no fetch/XHR requests, so `connectDomains` is empty. No nested iframe is used. On 2026-10-03, an HTTPS HEAD probe returned `200 OK`, `Content-Type: audio/mpeg`, `Access-Control-Allow-Origin: *`, and no redirect. This establishes endpoint reachability from the probe environment only. Whether ChatGPT's iframe CSP permits media and whether the stream plays audibly there remain unobserved. Check the browser's Network and Console panels in the host test; a redirect to a different origin would require reconsidering the allowlist.

Play/Pause, buffering, and error state live in the current UI instance. A remount, page reload, or new conversation resets the player to idle; the user must press Play again. There is no storage or background playback guarantee. Pause calls `HTMLMediaElement.pause()`. Resume calls `play()` on the same element and rejoins the live stream rather than resuming an archived position. The button remains usable while buffering, and rejected `play()` promises or media errors show a retryable error.

[Official OpenAI UI guidance](https://developers.openai.com/plugins/build/chatgpt-ui) describes picture-in-picture as a presentation for ongoing activities, including live sessions. This makes host PiP plausible for a radio player, but this proof does not request PiP and has no evidence that this ChatGPT account exposes it or keeps audio playing in that mode. Browser-native video PiP is not part of the audio element.

## ChatGPT host check still needed

A publicly reachable HTTPS endpoint is needed for ChatGPT to connect to `/mcp`. No endpoint or ChatGPT connection is established by this repository. After an authorized tester supplies one, use [OpenAI's developer-mode connection instructions](https://developers.openai.com/plugins/build/app-quickstart) to connect the full `https://…/mcp` URL, refresh the connection, select the plugin in a new chat, and ask it to “Open the Radio Paradise live player.” Record the endpoint origin and test time without credentials.

In that ChatGPT chat, verify the inline UI actually renders. Press Play and confirm audible live audio and a `Playing live` state. Press Pause and confirm silence; press Play again and confirm audio returns. While connecting, press Pause to confirm it is responsive. Watch the iframe Console and Network panels for CSP violations, request URLs/redirects, response status, and media errors. For a controlled failure, select the player iframe in DevTools, set `document.querySelector('#radio').src = 'https://stream.radioparadise.com/definitely-missing-dial-proof'`, and press Play; verify the error state and Play retry control. Restore the original URL or reopen the UI to retest. Reload or reopen the UI to confirm the expected idle reset. If ChatGPT offers a PiP control for this UI, enter it and check whether the player remains visible and audible while continuing the chat; record absence of the control if none appears. These are manual host observations to be recorded by Verify, not outcomes claimed here.
