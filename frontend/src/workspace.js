import { validLayout } from './panes.js';

export function readLastWorkspace() {
  try {
    const id = JSON.parse(localStorage.getItem('pdash.workspace'));
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

export function selectedWorkspace(workspaces, id) {
  return (
    workspaces.find((workspace) => workspace.id === id) ||
    workspaces.find((workspace) => workspace.id === 'default') ||
    workspaces[0]
  );
}

export function readView(id) {
  try {
    const value = JSON.parse(localStorage.getItem(`pdash.view.${id}`)) || {};
    if (!Array.isArray(value.panes) || !value.panes.length || value.panes.some((pane) =>
      !pane || typeof pane.id !== 'string' || typeof pane.tab !== 'string' ||
      typeof pane.query !== 'string' || !(pane.sources === null ||
        (Array.isArray(pane.sources) && pane.sources.every((id) => typeof id === 'string')))) ||
      new Set(value.panes.map((pane) => pane.id)).size !== value.panes.length ||
      !validLayout(value.layout, value.panes.map((pane) => pane.id))) {
      return { panes: [{ id: 'main', tab: 'combined', query: '', sources: null }], layout: 'main' };
    }
    return { panes: value.panes, layout: value.layout };
  } catch {
    return { panes: [{ id: 'main', tab: 'combined', query: '', sources: null }], layout: 'main' };
  }
}
export function remember(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be disabled. */
  }
}
export function workspaceCommands(commands, id) {
  return commands.filter((c) => (c.workspaceId || 'default') === id);
}
export function streamCommands(commands, sources) {
  return sources === null ? commands : commands.filter((c) => sources.includes(c.id));
}
