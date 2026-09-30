import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readLastWorkspace,
  selectedWorkspace,
  readView,
  remember,
  workspaceCommands,
  streamCommands,
} from '../src/workspace.js';

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

test('last workspace restores after reload and falls back safely when deleted or storage is unavailable', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key),
    setItem: (key, value) => data.set(key, value),
  };
  const workspaces = [{ id: 'one' }, { id: 'default' }, { id: 'two' }];
  remember('pdash.workspace', 'two');
  assert.equal(selectedWorkspace(workspaces, readLastWorkspace()).id, 'two');
  assert.equal(
    selectedWorkspace(
      workspaces.filter((w) => w.id !== 'two'),
      readLastWorkspace(),
    ).id,
    'default',
  );
  assert.equal(selectedWorkspace([], readLastWorkspace()), undefined);
  assert.equal(readLastWorkspace(), 'two');
  data.set('pdash.workspace', '{broken');
  assert.equal(readLastWorkspace(), null);
  data.set('pdash.workspace', '123');
  assert.equal(readLastWorkspace(), null);
  delete globalThis.localStorage;
  assert.equal(selectedWorkspace(workspaces, readLastWorkspace()).id, 'default');
});
