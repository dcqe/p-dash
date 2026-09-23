import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildApp } from '../server/app.js';

test('SSE replays output and MCP controls the same process manager end to end', async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pdash-transport-'));
  const port = 14319;
  const app = await buildApp({ dir, port, managerOptions: { graceMs: 200 } });
  await app.listen({ host: '127.0.0.1', port });
  const client = new Client({ name: 'test-agent', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve('bin/mcp.js')],
    env: { ...process.env, PDASH_URL: `http://127.0.0.1:${port}`, PDASH_DATA: dir },
  });
  t.after(async () => {
    await client.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 11);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, result.content[0].text);
    return JSON.parse(result.content[0].text);
  };
  const command = await call('create_command', {
    name: 'agent fixture',
    command: `"${process.execPath}" "${path.resolve('test/worker.js')}"`,
    cwd: process.cwd(),
  });
  const group = await call('save_group', { name: 'agent group', processIds: [command.id] });
  const started = await call('control_group', { id: group.id, action: 'start' });
  assert.equal(started[0].ok, true);
  await call('send_input', { id: command.id, data: 'agent-check\r' });
  await call('resize_terminal', { id: command.id, cols: 100, rows: 25 });
  let logs;
  const end = Date.now() + 10000;
  do {
    logs = await call('read_output', { ids: [command.id], plain: true });
    if (logs.events.some((e) => e.data?.includes('agent-check'))) break;
    await new Promise((r) => setTimeout(r, 50));
  } while (Date.now() < end);
  assert.ok(logs.events.some((e) => e.data?.includes('agent-check')));
  const controller = new AbortController();
  const stream = await fetch(`http://127.0.0.1:${port}/api/events?after=0`, {
    headers: { authorization: `Bearer ${app.token}` },
    signal: controller.signal,
  });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!buffer.includes('\n\n')) buffer += decoder.decode((await reader.read()).value);
  const snapshot = JSON.parse(
    buffer
      .split('\n')
      .find((line) => line.startsWith('data: '))
      .slice(6),
  );
  assert.equal(snapshot.type, 'snapshot');
  assert.ok(snapshot.events.some((e) => e.type === 'output'));
  controller.abort();
  await call('control_command', { id: command.id, action: 'stop' });
  await call('update_command', { id: command.id, patch: { name: 'updated by agent' } });
  assert.equal((await call('status')).commands[0].name, 'updated by agent');
  await call('delete_group', { id: group.id });
  await call('delete_command', { id: command.id });
  assert.equal(app.manager.list().length, 0);
});
