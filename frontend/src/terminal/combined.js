// Streaming sanitizer: only SGR color/style escapes may reach the merged screen.
// Keep parser and incomplete line state independent for each PTY/run.
export class CombinedLines {
  constructor() {
    this.sources = new Map();
  }
  push(key, data) {
    const s = this.sources.get(key) || { mode: 'text', sequence: '', line: '', cr: false };
    const lines = [];
    const flush = () => {
      if (s.line) lines.push(s.line);
      s.line = '';
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
          if (ch === 'm' && /^[0-9;:]*$/.test(s.sequence)) s.line += `\x1b[${s.sequence}m`;
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
      if (ch === '\r' || ch === '\n') {
        if (!(ch === '\n' && s.cr)) flush();
        s.cr = ch === '\r';
        continue;
      }
      s.cr = false;
      if (ch === '\t' || (ch >= ' ' && ch !== '\x7f' && !(ch >= '\x80' && ch <= '\x9f')))
        s.line += ch;
      if (s.line.length >= 8192) flush();
    }
    this.sources.set(key, s);
    return lines;
  }
}
