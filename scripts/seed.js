import { request } from '../bin/client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const existing = await request('/commands');
const commands = [];
for (const [name, kind, color, ansi] of [
  ['gateway-demo', 'api', '#a5d87a', '32'],
  ['worker-demo', 'worker', '#9ba9ff', '35'],
  ['frontend-demo', 'web', '#eeb978', '33'],
]) {
  commands.push(
    existing.find((c) => c.name === name) ||
      (await request('/commands', 'POST', {
        name,
        command: `"${process.execPath}" "${path.join(root, 'scripts/demo-worker.js')}" ${kind} ${ansi}`,
        cwd: root,
        color,
      })),
  );
}
const groups = await request('/groups');
if (!groups.some((g) => g.name === 'Demo stack'))
  await request('/groups', 'POST', { name: 'Demo stack', processIds: commands.map((c) => c.id) });
console.log('Created three demo commands and a Demo stack group. Start them from the dashboard.');
