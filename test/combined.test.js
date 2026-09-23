import test from 'node:test';
import assert from 'node:assert/strict';
import { CombinedLines } from '../src/combined.js';
test('merged output isolates split ANSI/control sequences and line fragments by source', () => {
  const c = new CombinedLines();
  assert.deepEqual(c.push('a', '\x1b[3'), []);
  assert.deepEqual(c.push('b', 'other\r\n'), ['other']);
  assert.deepEqual(c.push('a', '2mgreen\x1b[0m\x1b[2J\n'), ['\x1b[32mgreen\x1b[0m']);
  assert.deepEqual(c.push('a', '\x1b]0;unsafe title'), []);
  assert.deepEqual(c.push('a', '\x07safe\x1bcremainder\r'), ['saferemainder']);
  assert.deepEqual(c.push('a', '\nnext\n'), ['next']);
  assert.deepEqual(c.push('a', 'par'), []);
  assert.deepEqual(c.push('a', 'tial\n'), ['partial']);
});
