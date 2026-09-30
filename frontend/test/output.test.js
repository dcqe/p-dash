import test from 'node:test';
import assert from 'node:assert/strict';
import { lastTerminalLines } from '../src/terminal/output.js';

function buffer(rows) {
  return {
    length: rows.length,
    getLine: (index) =>
      rows[index] && {
        isWrapped: rows[index].wrapped || false,
        translateToString: (trim) => (trim ? rows[index].text.trimEnd() : rows[index].text),
      },
  };
}

test('copy takes the last requested messages, excluding empty screen rows', () => {
  const screen = buffer([
    ...Array.from({ length: 105 }, (_, i) => ({ text: `message ${i + 1}` })),
    { text: '   ' },
    { text: '' },
  ]);
  const copied = lastTerminalLines(screen, 100);
  assert.equal(copied.length, 100);
  assert.equal(copied[0], 'message 6');
  assert.equal(copied.at(-1), 'message 105');
  assert.deepEqual(lastTerminalLines(screen, 2), ['message 104', 'message 105']);
});

test('copy joins wrapped rows without losing spaces and retains blank lines inside output', () => {
  const screen = buffer([
    { text: 'long message ' },
    { text: 'continued  ', wrapped: true },
    { text: '' },
    { text: 'final message  ' },
    { text: '' },
  ]);
  assert.deepEqual(lastTerminalLines(screen, 3), ['long message continued', '', 'final message']);
  assert.deepEqual(lastTerminalLines(buffer([{ text: '' }]), 100), []);
  assert.deepEqual(lastTerminalLines(null, 100), []);
});
