import test from 'node:test';
import assert from 'node:assert/strict';
import { restartAll } from '../src/process/restartAll.js';

const commands = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

test('restart all waits for every stop, clears at the server cursor, then starts', async () => {
  const calls = [];
  const stops = new Map();
  let finishClear;
  const restart = restartAll(commands, async (route) => {
    calls.push(route);
    if (route.endsWith('/stop')) return new Promise((resolve) => stops.set(route, resolve));
    if (route === '/status') return { cursor: 42 };
  }, (cursor) => {
    calls.push(`clear:${cursor}`);
    return new Promise((resolve) => { finishClear = resolve; });
  }, (id) => calls.push(`launch:${id}`));

  stops.get('/commands/b/stop')({ alive: false });
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['/commands/a/stop', '/commands/b/stop']);
  stops.get('/commands/a/stop')({ alive: false });
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['/commands/a/stop', '/commands/b/stop', '/status', 'clear:42']);
  finishClear();
  await restart;
  assert.deepEqual(calls.slice(4), ['launch:a', '/commands/a/start', 'launch:b', '/commands/b/start']);
});

test('stop failures or live processes prevent clearing and starting', async () => {
  for (const stillAlive of [false, true]) {
    const calls = [];
    await assert.rejects(restartAll(commands, async (route) => {
      calls.push(route);
      if (route === '/commands/a/stop' && !stillAlive) throw new Error('Stop rejected');
      return { alive: stillAlive };
    }, () => assert.fail('Must preserve logs'), () => assert.fail('Must not start')), /Stop failed/);
    assert.deepEqual(calls, ['/commands/a/stop', '/commands/b/stop']);
  }
});

test('restart all checks every start outcome and reports every failure', async () => {
  const starts = [];
  await assert.rejects(restartAll(commands, async (route) => {
    if (route.endsWith('/stop')) return { alive: false };
    if (route === '/status') return { cursor: 50 };
    starts.push(route);
    throw new Error(route);
  }, () => {}, () => {}), (error) => {
    assert.match(error.message, /Start failed/);
    assert.match(error.message, /\/commands\/a\/start/);
    assert.match(error.message, /\/commands\/b\/start/);
    return true;
  });
  assert.deepEqual(starts, ['/commands/a/start', '/commands/b/start']);
});
