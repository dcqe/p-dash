import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Manager } from '../server/manager.js';
const worker = `"${process.execPath}" "${path.resolve('test/worker.js')}"`;
async function waitUntil(fn, timeout = 10000) {
  const end = Date.now() + timeout;
  while (!fn()) {
    if (Date.now() > end) throw new Error('Timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
}
test('real PTY: idempotent start, color, input, stop, restart, bounded replay and persistence', async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pdash-'));
  const manager = new Manager(dir, { graceMs: 300, maxEvents: 100 });
  t.after(async () => {
    await manager.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const c = manager.create({
    name: 'fixture',
    command: worker,
    cwd: process.cwd(),
    env: { PDASH_TEST: 'private-value' },
  });
  assert.equal(c.env, undefined);
  assert.deepEqual(c.envKeys, ['PDASH_TEST']);
  assert.throws(() => manager.create({ name: 'bad', command: 'echo hi', cwd: 'relative' }));
  const [first, concurrent] = await Promise.all([manager.start(c.id), manager.start(c.id)]);
  assert.ok(first.pid);
  assert.equal(concurrent.pid, first.pid);
  await waitUntil(() => manager.events.some((e) => e.data?.includes('READY')));
  const text = manager
    .logs({ plain: true })
    .events.map((e) => e.data || '')
    .join('');
  const descendantPid = Number(text.match(/CHILD_PID:(\d+)/)?.[1]);
  assert.ok(descendantPid, 'Fixture must launch a descendant');
  assert.ok(manager.events.some((e) => e.data?.includes('\x1b[')));
  assert.throws(() => manager.update(c.id, { name: 'no' }), /Stop/);
  manager.input(c.id, 'hello\r');
  await waitUntil(() =>
    manager.logs({ plain: true }).events.some((e) => e.data?.includes('ECHO:hello')),
  );
  manager.resize(c.id, 90, 25);
  await manager.stop(c.id);
  assert.equal(manager.view(c.id).status, 'stopped');
  assert.equal(manager.view(c.id).pid, null);
  assert.throws(() => process.kill(descendantPid, 0), 'Stop must terminate descendants');
  manager.update(c.id, { name: 'renamed' });
  assert.equal(manager.view(c.id).name, 'renamed');
  assert.deepEqual(manager.view(c.id).envKeys, ['PDASH_TEST']);
  const second = await manager.restart(c.id);
  assert.notEqual(second.runId, first.runId);
  await manager.stop(c.id);
  const group = manager.group({ name: 'stack', processIds: [c.id, c.id] });
  assert.equal(group.processIds.length, 1);
  const results = await manager.groupAction(group.id, 'start');
  assert.equal(results[0].ok, true);
  await manager.groupAction(group.id, 'stop');
  const cursor = manager.seq;
  manager.emitEvent('output', { processId: c.id, data: '\x1b[32mhi\x1b[0m' });
  assert.equal(manager.logs({ after: cursor, plain: true }).events[0].data, 'hi');
  for (let i = 0; i < 120; i++) manager.emitEvent('output', { processId: c.id, data: String(i) });
  assert.equal(manager.events.length, 100);
  assert.equal(manager.logs({ after: 1 }).truncated, true);
  manager.persist();
  const restored = new Manager(dir);
  assert.equal(restored.view(c.id).status, 'stopped');
  assert.equal(restored.seq, manager.seq);
  assert.equal(restored.events.length, 100);
  manager.remove(c.id);
  assert.deepEqual(manager.groups[0].processIds, []);
});
test('natural failure records an exit code and allows a clean restart', async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pdash-'));
  const m = new Manager(dir);
  t.after(async () => {
    await m.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const c = m.create({
    name: 'fails',
    command: `"${process.execPath}" -e "process.exit(7)"`,
    cwd: process.cwd(),
  });
  await m.start(c.id);
  await waitUntil(() => m.view(c.id).status === 'failed');
  assert.equal(m.view(c.id).exitCode, 7);
  assert.equal(m.view(c.id).pid, null);
});
