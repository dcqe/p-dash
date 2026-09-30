export function lastTerminalLines(buffer, count) {
  if (!buffer) return [];
  const lines = [];
  for (let i = 0; i < buffer.length; i++) {
    const line = buffer.getLine(i);
    if (!line) continue;
    const text = line.translateToString(!buffer.getLine(i + 1)?.isWrapped);
    if (line.isWrapped && lines.length) lines[lines.length - 1] += text;
    else lines.push(text);
  }
  // Empty terminal rows below the last message are not output.
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return lines.slice(-count);
}
