import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { discover, MEDIA_ORIGINS, reportClick } from './discovery.js';

const UI_URI = 'ui://dial/radio-v9.html';
const DISCOVERY_URI = 'ui://dial/country-v12.html';
const PROBE_URI = 'ui://dial/capability-probe-v2.html';
const STATION = {
  name: 'Radio Paradise',
  provider: 'Radio Paradise',
  streamUrl: 'https://stream.radioparadise.com/mp3-128',
  format: 'MP3 128 kbps',
  sourceUrl: 'https://radioparadise.com/listen/stream-links'
};
const playerPath = fileURLToPath(new URL('../public/player.html', import.meta.url));
const scriptPath = fileURLToPath(new URL('./player.js', import.meta.url));
const html = readFileSync(playerPath, 'utf8').replace('/* PLAYER_SCRIPT */', () => readFileSync(scriptPath, 'utf8'));
const discoveryHtml = readFileSync(fileURLToPath(new URL('../public/discovery.html', import.meta.url)), 'utf8').replace('/* PLAYER_SCRIPT */', () => readFileSync(scriptPath, 'utf8'));
const probeHtml = readFileSync(fileURLToPath(new URL('../public/probe.html', import.meta.url)), 'utf8').replace('/* PROBE_SCRIPT */', () => readFileSync(fileURLToPath(new URL('./probe.js', import.meta.url)), 'utf8'));
const providerOrigin = process.env.RADIO_BROWSER_API_ORIGIN ?? 'https://de1.api.radio-browser.info';

function makeServer() {
  const server = new McpServer({ name: 'dial-radio-proof', version: '0.1.0' });
  registerAppResource(server, 'One-station radio player', UI_URI, {}, async () => ({
    contents: [{
      uri: UI_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: html,
      _meta: {
        ui: {
          prefersBorder: true,
          csp: {
            connectDomains: [],
            resourceDomains: ['https://stream.radioparadise.com']
          }
        }
      }
    }]
  }));
  registerAppResource(server, 'Country radio player', DISCOVERY_URI, {}, async () => ({
    contents: [{ uri: DISCOVERY_URI, mimeType: RESOURCE_MIME_TYPE, text: discoveryHtml,
      _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [...MEDIA_ORIGINS] } } } }]
  }));
  registerAppResource(server, 'Dial two-thread capability probe v2', PROBE_URI, {}, async () => ({
    contents: [{ uri: PROBE_URI, mimeType: RESOURCE_MIME_TYPE, text: probeHtml,
      _meta: { ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: ['https://stream.radioparadise.com'] } } } }]
  }));
  registerAppTool(server, 'open_capability_probe', {
    title: 'Open Dial two-thread capability probe',
    description: 'Test Dial messaging, Web Locks, and post-transfer radio playback in two real ChatGPT threads. Diagnostic only.',
    inputSchema: {},
    _meta: { ui: { resourceUri: PROBE_URI } }
  }, async () => ({ content: [{ type: 'text', text: 'Open this probe in two ChatGPT threads in one browser profile. Use its controls and copy results from both frames.' }] }));
  registerAppTool(server, 'open_radio', {
    title: 'Open one live radio station',
    description: 'Show the Radio Paradise live player. Playback starts only when the user presses Play.',
    inputSchema: {},
    _meta: { ui: { resourceUri: UI_URI } }
  }, async () => ({
    content: [{ type: 'text', text: `One known station: ${STATION.name} (${STATION.provider}), ${STATION.format}. Source: ${STATION.sourceUrl}.` }],
    structuredContent: { station: STATION }
  }));
  registerAppTool(server, 'find_stations_by_country', {
    title: 'Find radio stations by country',
    description: 'Collect up to 30 compatible MP3 catalog choices from three bounded Radio Browser windows for an ISO alpha-2 country code, such as FR. Stream playback is not guaranteed.',
    inputSchema: { countryCode: z.string().optional(), requestId: z.string().max(80).optional() },
    _meta: { ui: { resourceUri: DISCOVERY_URI } }
  }, async ({ countryCode, requestId }) => {
    const result = await discover(countryCode, { providerOrigin });
    const message = result.status === 'invalid_country' ? 'Invalid country code. Use an assigned ISO alpha-2 code such as FR.'
      : `${result.stations.length} compatible catalog choices for ${result.countryCode} in three bounded provider windows. Scan ${result.scanState}. ${result.choiceLimitReached ? '30-choice limit reached. ' : ''}Select one in the player; audible playback is not guaranteed.`;
    return { content: [{ type: 'text', text: `${message} Radio Browser: https://docs.radio-browser.info/. Playing a station reports its UUID and server IP to Radio Browser.` }], structuredContent: requestId === undefined ? result : { ...result, requestId } };
  });
  registerAppTool(server, 'retry_stations_by_country', {
    title: 'Retry country station scan',
    description: 'Retry the same three bounded Radio Browser windows after an incomplete scan.',
    inputSchema: { countryCode: z.string() },
    _meta: { ui: { resourceUri: DISCOVERY_URI, visibility: ['app'] } }
  }, async ({ countryCode }) => {
    const result = await discover(countryCode, { providerOrigin, kind: 'retry' });
    return { content: [{ type: 'text', text: `${result.stations.length} compatible catalog choices for ${result.countryCode}; scan ${result.scanState}. Radio Browser: https://docs.radio-browser.info/.` }], structuredContent: result };
  });
  registerAppTool(server, 'report_station_click', {
    title: 'Report a radio play', description: 'Best-effort Radio Browser play count after user playback starts.',
    inputSchema: { clickToken: z.string() },
    _meta: { ui: { resourceUri: DISCOVERY_URI, visibility: ['app'] } }
  }, async ({ clickToken }) => {
    const counted = await reportClick(clickToken, { providerOrigin });
    if (!counted) console.warn('Radio Browser click report failed');
    return { content: [{ type: 'text', text: counted ? 'Play counted.' : 'Play count unavailable; audio is unaffected.' }], structuredContent: { counted } };
  });
  return server;
}

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

createServer(async (req, res) => {
  const path = req.url ? new URL(req.url, 'http://localhost').pathname : '';
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('Dial one-station MCP proof');
    return;
  }
  if (path === '/mcp' && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, GET, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type, accept, mcp-session-id, mcp-protocol-version',
      'access-control-expose-headers': 'mcp-session-id'
    }).end();
    return;
  }
  if (path !== '/mcp' || !['POST', 'GET', 'DELETE'].includes(req.method ?? '')) {
    res.writeHead(404).end('Not Found');
    return;
  }
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-expose-headers', 'mcp-session-id');
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('MCP request failed', error);
    if (!res.headersSent) res.writeHead(500).end('Internal server error');
  }
}).listen(port, host, () => console.log(`Dial MCP listening at http://${host}:${port}/mcp`));
