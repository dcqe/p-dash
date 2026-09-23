#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { request } from './client.js';
const server = new McpServer({ name: 'p-dash', version: '0.1.0' });
function tool(name, description, inputSchema, fn) {
  server.registerTool(name, { description, inputSchema }, async (args) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await fn(args)) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  });
}
tool(
  'status',
  'List command definitions, process states, groups and the latest output cursor.',
  {},
  () => request('/status'),
);
const fields = {
  name: z.string(),
  command: z.string(),
  cwd: z.string(),
  color: z.string().optional(),
  env: z.record(z.string()).optional(),
};
tool(
  'create_command',
  'Save a shell command. cwd must be an absolute existing directory. Does not start it.',
  fields,
  (args) => request('/commands', 'POST', args),
);
tool(
  'update_command',
  'Update a stopped command. Omitted environment overrides are preserved.',
  { id: z.string(), patch: z.object(fields).partial() },
  ({ id, patch }) => request(`/commands/${id}`, 'PATCH', patch),
);
tool(
  'delete_command',
  'Delete a stopped command and remove it from groups.',
  { id: z.string() },
  ({ id }) => request(`/commands/${id}`, 'DELETE'),
);
tool(
  'control_command',
  'Start, stop or restart a command. Stop waits for termination. Running does not imply ready.',
  { id: z.string(), action: z.enum(['start', 'stop', 'restart']) },
  ({ id, action }) => request(`/commands/${id}/${action}`, 'POST'),
);
tool(
  'read_output',
  'Read output with a resumable global cursor; plain strips terminal controls. Check truncated and continue from cursor when cursor < latest.',
  {
    ids: z.array(z.string()).optional(),
    after: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(12000).optional(),
    plain: z.boolean().optional(),
  },
  ({ ids = [], after = 0, limit = 1000, plain = true }) =>
    request(`/logs?ids=${ids.join(',')}&after=${after}&limit=${limit}&plain=${plain}`),
);
tool(
  'send_input',
  'Write exact text or control characters to one running terminal. Include carriage return to submit a line.',
  { id: z.string(), data: z.string() },
  ({ id, data }) => request(`/commands/${id}/input`, 'POST', { data }),
);
tool(
  'resize_terminal',
  'Resize a command PTY.',
  { id: z.string(), cols: z.number().int(), rows: z.number().int() },
  ({ id, ...size }) => request(`/commands/${id}/resize`, 'POST', size),
);
tool(
  'save_group',
  'Create or replace a group of commands used for a merged terminal and batch actions.',
  { id: z.string().optional(), name: z.string(), processIds: z.array(z.string()) },
  ({ id, ...group }) => request(id ? `/groups/${id}` : '/groups', id ? 'PUT' : 'POST', group),
);
tool(
  'delete_group',
  'Delete a group without stopping its commands.',
  { id: z.string() },
  ({ id }) => request(`/groups/${id}`, 'DELETE'),
);
tool(
  'control_group',
  'Start, stop or restart every member; inspect each returned member result for errors.',
  { id: z.string(), action: z.enum(['start', 'stop', 'restart']) },
  ({ id, action }) => request(`/groups/${id}/${action}`, 'POST'),
);
await server.connect(new StdioServerTransport());
