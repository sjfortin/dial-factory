import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const UI_URI = 'ui://dial/radio-v2.html';
const STATION = {
  name: 'Radio Paradise',
  provider: 'Radio Paradise',
  streamUrl: 'https://stream.radioparadise.com/mp3-128',
  format: 'MP3 128 kbps',
  sourceUrl: 'https://radioparadise.com/listen/stream-links'
};
const playerPath = fileURLToPath(new URL('../public/player.html', import.meta.url));
const scriptPath = fileURLToPath(new URL('./player.js', import.meta.url));
const html = readFileSync(playerPath, 'utf8').replace('/* PLAYER_SCRIPT */', readFileSync(scriptPath, 'utf8'));

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
  registerAppTool(server, 'open_radio', {
    title: 'Open one live radio station',
    description: 'Show the Radio Paradise live player. Playback starts only when the user presses Play.',
    inputSchema: {},
    _meta: { ui: { resourceUri: UI_URI } }
  }, async () => ({
    content: [{ type: 'text', text: `One known station: ${STATION.name} (${STATION.provider}), ${STATION.format}. Source: ${STATION.sourceUrl}.` }],
    structuredContent: { station: STATION }
  }));
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
