import test from 'node:test';
import assert from 'node:assert/strict';
import { CombinedLines } from '../src/terminal/combined.js';
test('merged output isolates split ANSI/control sequences and line fragments by source', () => {
  const c = new CombinedLines();
  assert.deepEqual(c.push('a', '\x1b[3'), []);
  assert.deepEqual(c.push('b', 'other\r\n'), ['other']);
  assert.deepEqual(c.push('a', '2mgreen\x1b[0m\x1b[2J\n'), ['\x1b[32mgreen\x1b[0m']);
  assert.deepEqual(c.push('a', '\x1b]0;unsafe title'), []);
  assert.deepEqual(c.push('a', '\x07safe\x1bcremainder\r'), []);
  assert.deepEqual(c.push('a', '\nnext\n'), ['saferemainder', 'next']);
  assert.deepEqual(c.push('a', 'par'), []);
  assert.deepEqual(c.push('a', 'tial\n'), ['partial']);
});

test('Quarkus footer redraws stay out of combined logs without swallowing application output', () => {
  const c = new CombinedLines();
  const footer =
    '\x1b[28;0H\x1b[J\x1b[27;0H\r\n--\r\n' +
    '\x1b[94mTests paused\x1b[39m\r\nPress [e] for options>';
  assert.deepEqual(c.push('app', footer), []);
  assert.deepEqual(c.push('app', footer), []);
  const log =
    '\x1b[27;0H\x1b[J\x1b[30;0H\x1b[27;0H\x1b[J' +
    '\x1b[26;1HINFO Started\r\n\x1b[30;0H\r\n' +
    footer;
  assert.deepEqual(c.push('app', log), ['INFO Started']);
  assert.deepEqual(c.push('app', log), ['INFO Started']);
  const banner =
    '\x1b[27;0H\x1b[J\x1b[26;1Hbanner line 1\r\nbanner line 2\r\n' + 'INFO Started\r\n' + footer;
  assert.deepEqual(c.push('app', banner), ['banner line 1', 'banner line 2', 'INFO Started']);
  assert.deepEqual(c.push('other', 'Tests paused\nTests paused\n'), [
    'Tests paused',
    'Tests paused',
  ]);
});

test('screen redraw parsing is independent of output chunk boundaries', () => {
  const c = new CombinedLines();
  const output =
    '\x1b[10;1H\x1b[J\x1b[9;1H\r\nstatus\r\nkeys>' +
    '\x1b[10;1H\x1b[J\x1b[9;1H\x1b[32mreal log\x1b[0m\r\n';
  const lines = [...output].flatMap((character) => c.push('app', character));
  assert.deepEqual(lines, ['\x1b[32mreal log\x1b[0m']);
});

test('carriage-return progress rewrites produce one final line and split CRLF remains a newline', () => {
  const c = new CombinedLines();
  assert.deepEqual(c.push('app', '10%\r20%\r'), []);
  assert.deepEqual(c.push('app', '\x1b[32m100%\x1b[0m\r'), []);
  assert.deepEqual(c.push('app', '\nDone\r\nDone\n'), ['\x1b[32m100%\x1b[0m', 'Done', 'Done']);
});

test('redraw regions follow terminal resizing and do not leak across sources or runs', () => {
  const c = new CombinedLines();
  assert.deepEqual(c.push('app:run1', '\x1b[10;1H\x1b[J\r\nold footer\r\n'), []);
  assert.deepEqual(c.push('app:run1', '\x1b[40;1H\x1b[J\x1b[39;1HLog after resize\r\n'), [
    'Log after resize',
  ]);
  assert.deepEqual(c.push('app:run2', 'Log from new run\n'), ['Log from new run']);
  assert.deepEqual(c.push('other', 'Other log\n'), ['Other log']);
});
