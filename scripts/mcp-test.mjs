#!/usr/bin/env node
/**
 * Test MCP server: list tools and optionally call the chat tool.
 * Usage: node scripts/mcp-test.mjs [baseUrl]
 * Example: node scripts/mcp-test.mjs https://shvm.in/mcp
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const baseUrl = process.argv[2] || 'https://shvm.in/mcp';

async function main() {
  const url = new URL(baseUrl);
  const client = new Client(
    { name: 'mcp-test', version: '1.0.0' },
    { capabilities: {} }
  );

  console.log('Connecting to', url.href, '...');
  const transport = new StreamableHTTPClientTransport(url);
  await client.connect(transport);
  console.log('Connected.\n');

  console.log('--- List tools ---');
  const listResult = await client.listTools();
  const tools = listResult.tools || [];
  console.log('Tool count:', tools.length);
  for (const t of tools) {
    console.log('  -', t.name, ':', (t.description || '').slice(0, 60) + (t.description?.length > 60 ? '...' : ''));
  }

  if (tools.length === 0) {
    console.log('\nNo tools returned. Check server and schema registration.');
    process.exit(1);
  }

  const chatTool = tools.find((t) => t.name === 'chat' || t.name.includes('chat')) || tools[0];
  console.log('\n--- Call tool:', chatTool.name, '---');
  const callResult = await client.callTool({
    name: chatTool.name,
    arguments: { messages: [{ role: 'user', content: 'Hi' }] },
  });

  if (callResult.isError) {
    console.log('Error:', callResult.content);
    process.exit(1);
  }

  const content = callResult.content;
  const textPart = Array.isArray(content) && content[0]?.text != null ? content[0].text : JSON.stringify(content);
  console.log('Response:', textPart.slice(0, 500) + (textPart.length > 500 ? '...' : ''));
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
