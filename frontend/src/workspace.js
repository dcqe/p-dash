export function readView(id) {
  try {
    const value = JSON.parse(localStorage.getItem(`pdash.view.${id}`)) || {};
    return {
      tab: typeof value.tab === 'string' ? value.tab : 'combined',
      query: typeof value.query === 'string' ? value.query : '',
      paused: value.paused === true,
      sources: Array.isArray(value.sources)
        ? value.sources.filter((v) => typeof v === 'string')
        : null,
    };
  } catch {
    return { tab: 'combined', query: '', paused: false, sources: null };
  }
}
export function remember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be disabled. */
  }
}
export function lastWorkspace() {
  try {
    return JSON.parse(localStorage.getItem('pdash.workspace')) || 'default';
  } catch {
    return 'default';
  }
}
export function workspaceCommands(commands, id) {
  return commands.filter((c) => (c.workspaceId || 'default') === id);
}
export function streamCommands(commands, sources) {
  return sources === null ? commands : commands.filter((c) => sources.includes(c.id));
}
