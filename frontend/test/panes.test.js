import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPane, updatePane, splitLayout, closeLayout, paneGrid, validLayout } from '../src/panes.js';
import { readView } from '../src/workspace.js';

test('split duplicates a view beside its source and subsequent changes stay independent', () => {
  const original = [{ id: 'left', tab: 'combined', query: 'error', sources: ['demo'] }];
  const split = splitPane(original, 'left', 'right');
  assert.deepEqual(split.map((pane) => pane.id), ['left', 'right']);
  assert.deepEqual(split[1], { ...original[0], id: 'right' });
  assert.notEqual(split[1].sources, split[0].sources);
  const updated = updatePane(split, 'right', { tab: 'demo', query: '', sources: [] });
  assert.deepEqual(updated[0], original[0]);
  assert.equal(updated[1].tab, 'demo');
  assert.equal(original.length, 1);
});

test('invalid pane storage initializes a fresh view without converting older formats', () => {
  for (const value of [{ tab: 'demo' }, { panes: [] }, { panes: [null] },
    { panes: [{ id: 'a', tab: 'combined', query: '', sources: 3 }] },
    { panes: Array(2).fill({ id: 'same', tab: 'combined', query: '', sources: null }) }]) {
    globalThis.localStorage = { getItem: () => JSON.stringify(value) };
    assert.deepEqual(readView('workspace'), { panes: [{ id: 'main', tab: 'combined', query: '', sources: null }], layout: 'main' });
  }
  delete globalThis.localStorage;
});


test('split right then down confines the lower pane to the selected side', () => {
  const sideBySide = splitLayout('left', 'left', 'right', 'right');
  assert.deepEqual(paneGrid(sideBySide).panes, {
    left: { gridColumn: '1 / 2', gridRow: '1 / 2' },
    right: { gridColumn: '2 / 3', gridRow: '1 / 2' },
  });
  const mixed = splitLayout(sideBySide, 'right', 'bottom', 'down');
  assert.deepEqual(paneGrid(mixed).panes, {
    left: { gridColumn: '1 / 2', gridRow: '1 / 3' },
    right: { gridColumn: '2 / 3', gridRow: '1 / 2' },
    bottom: { gridColumn: '2 / 3', gridRow: '2 / 3' },
  });
  assert.equal(validLayout(mixed, ['left', 'right', 'bottom']), true);
  assert.equal(validLayout(mixed, ['left', 'right']), false);
  assert.deepEqual(closeLayout(mixed, 'bottom'), sideBySide);
  assert.deepEqual(closeLayout(mixed, 'left'), { direction: 'down', first: 'right', second: 'bottom' });
  assert.equal(closeLayout(sideBySide, 'right'), 'left');
});

test('split down then right supports a wide top pane over two lower panes', () => {
  const stacked = splitLayout('top', 'top', 'bottom', 'down');
  assert.deepEqual(paneGrid(stacked).panes, {
    top: { gridColumn: '1 / 2', gridRow: '1 / 2' },
    bottom: { gridColumn: '1 / 2', gridRow: '2 / 3' },
  });
  const mixed = splitLayout(stacked, 'bottom', 'bottom-right', 'right');
  assert.deepEqual(paneGrid(mixed).panes.top, { gridColumn: '1 / 3', gridRow: '1 / 2' });
  assert.deepEqual(paneGrid(mixed).panes['bottom-right'], { gridColumn: '2 / 3', gridRow: '2 / 3' });
  assert.equal(validLayout({ direction: 'diagonal', first: 'top', second: 'bottom' }, ['top', 'bottom']), false);
});
