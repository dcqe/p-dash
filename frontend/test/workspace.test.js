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
  remember('pdash.view.one', { layout: { direction: 'right', first: 'left', second: 'right' }, panes: [{ id: 'left', tab: 'a', query: 'error', sources: ['a'] }, { id: 'right', tab: 'combined', query: '', sources: null }] });
  remember('pdash.view.two', { layout: 'main', panes: [{ id: 'main', tab: 'combined', query: '', sources: [] }] });
  assert.deepEqual(readView('one').panes[0], { id: 'left', tab: 'a', query: 'error', sources: ['a'] });
  assert.equal(readView('one').panes[1].tab, 'combined');
  assert.deepEqual(readView('one').layout, { direction: 'right', first: 'left', second: 'right' });
  assert.deepEqual(readView('two').panes[0].sources, []);
  data.set('pdash.view.one', '{broken');
  assert.equal(readView('one').panes[0].tab, 'combined');
  delete globalThis.localStorage;
  assert.equal(readView('one').panes[0].sources, null);
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
