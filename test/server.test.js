import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { exerciseDeliveredScript } from './ui-harness.js';

test('HTTP MCP tool returns the station and its renderable UI resource', async (t) => {
  const port = 20000 + Math.floor(Math.random() * 30000);
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', RADIO_BROWSER_API_ORIGIN: 'http://unavailable.test' },
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
  assert.equal(uri, 'ui://dial/radio-v4.html');

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
  assert.match(resource.contents[0].text, /id="remote-pause"/);
  assert.match(inlineScript, /dial-playback-channel-v1/);
  assert.doesNotThrow(() => new Script(inlineScript), 'delivered player script parses as JavaScript');
  assert.deepEqual(resource.contents[0]._meta.ui.csp.resourceDomains, ['https://stream.radioparadise.com']);
  const findTool = tools.tools.find((entry) => entry.name === 'find_stations_by_country');
  assert.ok(findTool);
  const invalid = await client.callTool({ name: 'find_stations_by_country', arguments: { countryCode: 'ZZ' } });
  assert.equal(invalid.structuredContent.status, 'invalid_country');
  const unavailable = await client.callTool({ name: 'find_stations_by_country', arguments: { countryCode: 'FR' } });
  assert.equal(unavailable.structuredContent.status, 'provider_unavailable');
  const countryResource = await client.readResource({ uri: findTool._meta.ui.resourceUri });
  assert.equal(findTool._meta.ui.resourceUri, 'ui://dial/country-v2.html');
  assert.match(countryResource.contents[0].text, /id="remote-pause"/);
  assert.deepEqual(countryResource.contents[0]._meta.ui.csp, {
    connectDomains: [],
    resourceDomains: ['https://stream.radioparadise.com', 'https://audio.bfmtv.com', 'https://media-ssl.musicradio.com']
  });
  assert.match(countryResource.contents[0].text, /Select a station to listen/);
  assert.doesNotMatch(countryResource.contents[0].text, /http:\/\/unavailable\.test/);
  const countryScript = countryResource.contents[0].text.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.equal(countryScript, readFileSync('dist/player.js', 'utf8'));
  assert.doesNotThrow(() => new Script(countryScript));
  await exerciseDeliveredScript(countryScript);
  const probeTool = tools.tools.find((entry) => entry.name === 'open_capability_probe');
  assert.ok(probeTool, 'dedicated host probe tool is registered');
  assert.equal(probeTool._meta.ui.resourceUri, 'ui://dial/capability-probe-v2.html');
  const probeResource = await client.readResource({ uri: probeTool._meta.ui.resourceUri });
  const delivered = probeResource.contents[0];
  assert.equal(delivered.mimeType, 'text/html;profile=mcp-app');
  assert.deepEqual(delivered._meta.ui.csp, { connectDomains: [], resourceDomains: ['https://stream.radioparadise.com'] });
  assert.match(delivered.text, /Open this tool in two separate ChatGPT threads/);
  assert.match(delivered.text, /Copy results/);
  assert.doesNotMatch(delivered.text, /\/\* PROBE_SCRIPT \*\//);
  const probeScript = delivered.text.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.equal(probeScript, readFileSync('dist/probe.js', 'utf8'));
  assert.doesNotThrow(() => new Script(probeScript));
  assert.match(probeScript, /dial-probe-channel-v2/);
  assert.match(probeScript, /dial-playback-v1/);
  assert.deepEqual(tools.tools.find((entry) => entry.name === 'report_station_click')?._meta?.ui?.visibility, ['app']);
});
