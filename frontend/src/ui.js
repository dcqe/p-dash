// Command identity accents; surrounding dashboard surfaces remain neutral grey.
export const palette = [
  '#5B8FF9',
  '#61DDAA',
  '#65789B',
  '#F6BD16',
  '#7262FD',
  '#78D3F8',
  '#9661BC',
  '#F6903D',
  '#008685',
  '#F08BB4',
];
export const active = (c) => ['starting', 'running', 'stopping'].includes(c.status);
export const statusLabel = (s) =>
  (s || 'unknown').toLowerCase().replace(/(^|_)\w/g, (m) => m.toUpperCase());
export const ago = (t) => {
  if (!t) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(t)) / 1000));
  return s < 60
    ? `${s}s`
    : s < 3600
      ? `${Math.floor(s / 60)}m ${s % 60}s`
      : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
export const plain = (s) =>
  s
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
export function retainEvents(events) {
  let bytes = 0;
  let start = events.length;
  while (start > 0 && events.length - start < 12000) {
    const size = (events[start - 1].data?.length || 300) * 2;
    if (bytes + size > 4 * 1024 * 1024) break;
    bytes += size;
    start--;
  }
  return events.slice(start);
}
