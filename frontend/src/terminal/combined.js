// Keep terminal redraws out of append-only logs; only SGR styles reach the merged screen.
// Parser, cursor, and incomplete line state belong to one source/run.
export class CombinedLines {
  constructor() {
    this.sources = new Map();
  }
  push(key, data) {
    const s = this.sources.get(key) || {
      mode: 'text',
      sequence: '',
      line: '',
      cr: false,
      row: null,
      column: 0,
      transientFrom: null,
      persistentBlock: false,
    };
    const lines = [];
    const flush = () => {
      if (
        s.line &&
        (s.persistentBlock || s.transientFrom === null || s.row === null || s.row < s.transientFrom)
      )
        lines.push(s.line);
      s.line = '';
    };
    const move = (row, column = 0) => {
      // An unfinished prompt belongs to its screen row, not the next log message.
      s.line = '';
      s.cr = false;
      s.row = row;
      s.column = column;
      s.persistentBlock = false;
    };
    const control = (final, sequence) => {
      if (!/^[0-9;:]*$/.test(sequence)) return;
      if (final === 'm') {
        if (s.cr) {
          s.line = '';
          s.cr = false;
          s.column = 0;
        }
        s.line += `\x1b[${sequence}m`;
        return;
      }
      const parameters = sequence.split(';').map(Number);
      const amount = parameters[0] || 1;
      if (final === 'H' || final === 'f') move(amount, Math.max(1, parameters[1] || 1) - 1);
      else if (final === 'd') move(amount, s.column);
      else if (s.row !== null && ['A', 'B', 'E', 'F'].includes(final))
        move(
          Math.max(1, s.row + (final === 'A' || final === 'F' ? -amount : amount)),
          final === 'E' || final === 'F' ? 0 : s.column,
        );
      else if (final === 'J' && (parameters[0] || 0) === 0 && s.row !== null) {
        // Addressed erase-to-end establishes a transient screen region (e.g. a dev footer).
        // Logs written above it remain ordinary output, even if their text repeats.
        s.transientFrom = s.row;
        s.line = '';
        s.cr = false;
        s.persistentBlock = false;
      } else if (final === 'J' && parameters[0] === 2) s.transientFrom = null;
      else if (final === 'K' && parameters[0] === 2) s.line = '';
    };
    for (const ch of data) {
      if (s.mode === 'escape') {
        s.mode = ch === '[' ? 'csi' : [']', 'P', '^', '_', 'X'].includes(ch) ? 'string' : 'text';
        s.sequence = '';
        continue;
      }
      if (s.mode === 'string') {
        if (ch === '\x07') s.mode = 'text';
        else if (ch === '\x1b') s.mode = 'stringEscape';
        continue;
      }
      if (s.mode === 'stringEscape') {
        s.mode = ch === '\\' ? 'text' : 'string';
        continue;
      }
      if (s.mode === 'csi') {
        if (ch >= '@' && ch <= '~') {
          control(ch, s.sequence);
          s.mode = 'text';
        } else if (s.sequence.length < 128) s.sequence += ch;
        else {
          s.mode = 'text';
          s.sequence = '';
        }
        continue;
      }
      if (ch === '\x1b') {
        s.mode = 'escape';
        continue;
      }
      if (ch === '\r') {
        // Wait for LF: a bare CR rewrites this line instead of adding a log entry.
        s.cr = true;
        continue;
      }
      if (ch === '\n') {
        flush();
        if (s.row !== null) s.row++;
        s.column = 0;
        s.cr = false;
        continue;
      }
      if (ch === '\t' || (ch >= ' ' && ch !== '\x7f' && !(ch >= '\x80' && ch <= '\x9f'))) {
        if (s.cr) {
          s.line = '';
          s.column = 0;
          s.cr = false;
        }
        s.line += ch;
        s.column++;
        // A log block can scroll through the footer's former rows (e.g. startup banners).
        // Keep it until an explicit cursor movement switches back to screen drawing.
        if (s.transientFrom !== null && s.row !== null && s.row < s.transientFrom)
          s.persistentBlock = true;
      }
      if (s.line.length >= 8192) flush();
    }
    this.sources.set(key, s);
    return lines;
  }
}
