import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('HTTP MCP tool returns the station and its renderable UI resource', async (t) => {
  const port = 20000 + Math.floor(Math.random() * 30000);
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => child.kill());
  let output = '';
  child.stderr.on('data', (chunk) => { output += chunk; });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) { ready = true; break; }
    } catch { /* wait for the listener */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.ok(ready, `Server did not start: ${output}`);

  const client = new Client({ name: 'dial-integration-test', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  await client.connect(transport);
  t.after(async () => { await client.close(); });

  const tools = await client.listTools();
  const radioTool = tools.tools.find((entry) => entry.name === 'open_radio');
  assert.ok(radioTool);
  const uri = radioTool._meta?.ui?.resourceUri;
  assert.match(uri, /^ui:\/\/dial\/radio-v\d+\.html$/);

  const result = await client.callTool({ name: 'open_radio', arguments: {} });
  assert.equal(result.structuredContent.station.name, 'Radio Paradise');
  assert.equal(result.structuredContent.station.streamUrl, 'https://stream.radioparadise.com/mp3-128');

  const resource = await client.readResource({ uri });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.match(resource.contents[0].text, /<audio[^>]+https:\/\/stream\.radioparadise\.com\/mp3-128/);
  assert.match(resource.contents[0].text, /ui\/initialize/);
  assert.doesNotMatch(resource.contents[0].text, /\/\* PLAYER_SCRIPT \*\//);
  const inlineScript = resource.contents[0].text.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript, 'UI resource contains an inline player script');
  assert.equal(inlineScript, readFileSync('dist/player.js', 'utf8'), 'MCP resource preserves the complete player bundle');
  assert.doesNotThrow(() => new Script(inlineScript), 'delivered player script parses as JavaScript');
  assert.deepEqual(resource.contents[0]._meta.ui.csp.resourceDomains, ['https://stream.radioparadise.com']);
});
