import test from 'node:test';
import assert from 'node:assert/strict';
import { readView, remember, workspaceCommands, streamCommands } from '../src/workspace.js';

test('workspace commands and combined selection cannot include another workspace', () => {
  const commands = [
    { id: 'old' },
    { id: 'a', workspaceId: 'one' },
    { id: 'b', workspaceId: 'two' },
  ];
  assert.deepEqual(
    workspaceCommands(commands, 'default').map((c) => c.id),
    ['old'],
  );
  const one = workspaceCommands(commands, 'one');
  assert.deepEqual(
    streamCommands(one, ['a', 'b']).map((c) => c.id),
    ['a'],
  );
  assert.deepEqual(streamCommands(one, []), []);
  assert.deepEqual(streamCommands(one, null), one);
});

test('views restore separately and tolerate unavailable or corrupt browser storage', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  remember('pdash.view.one', { tab: 'a', query: 'error', paused: true, sources: ['a'] });
  remember('pdash.view.two', { tab: 'combined', query: '', paused: false, sources: [] });
  assert.equal(readView('one').query, 'error');
  assert.deepEqual(readView('two').sources, []);
  data.set('pdash.view.one', '{broken');
  assert.equal(readView('one').tab, 'combined');
  delete globalThis.localStorage;
  assert.equal(readView('one').sources, null);
  assert.doesNotThrow(() => remember('x', {}));
});
