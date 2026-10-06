import React, { useEffect, useState } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Square,
  TerminalSquare,
  X,
} from 'lucide-react';
import { api } from './api/client.js';
import { useDashboard } from './api/useDashboard.js';
import { active, ago, statusLabel } from './ui.js';
import LogView from './terminal/LogView.jsx';
import { updatePane, splitPane, splitLayout, closeLayout, paneGrid } from './panes.js';
import CommandDialog from './process/CommandDialog.jsx';
import WorkspaceDialog from './process/WorkspaceDialog.jsx';
import WorkspacePicker from './process/WorkspacePicker.jsx';
import {
  readLastWorkspace,
  selectedWorkspace,
  readView,
  remember,
  workspaceCommands,
} from './workspace.js';
export default function App() {
  const [toast, setToast] = useState(null);
  const dashboard = useDashboard(setToast);
  const [selected, setSelected] = useState(readLastWorkspace);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => window.innerWidth >= 1280);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1280px)');
    const update = () => setSidebarExpanded(wide.matches);
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  }, []);
  const workspace = selectedWorkspace(dashboard.workspaces, selected);
  useEffect(() => {
    if (!workspace) return;
    if (selected !== workspace.id) setSelected(workspace.id);
    remember('pdash.workspace', workspace.id);
  }, [workspace?.id, selected]);
  if (!workspace)
    return (
      <div className="loading-state" role="status">
        {toast || (dashboard.connection === 'reconnecting' ? 'Connection lost. Retrying…' : 'Connecting…')}
      </div>
    );
  return (
    <WorkspaceDashboard
      key={workspace.id}
      dashboard={dashboard}
      workspace={workspace}
      onSwitch={setSelected}
      toast={toast}
      setToast={setToast}
      sidebarExpanded={sidebarExpanded}
      onToggleSidebar={() => setSidebarExpanded((value) => !value)}
    />
  );
}
function WorkspaceDashboard({ dashboard, workspace, onSwitch, toast, setToast, sidebarExpanded, onToggleSidebar }) {
  const [saved] = useState(() => readView(workspace.id));
  const [views, setViews] = useState(saved.panes);
  const [layout, setLayout] = useState(saved.layout);
  const grid = paneGrid(layout);
  const [activePane, setActivePane] = useState(saved.panes[0].id);
  const tab = views.find((view) => view.id === activePane)?.tab;
  const setTab = (tab) => setViews((current) => updatePane(current, activePane, { tab }));
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(new Set());
  const [launching, setLaunching] = useState(new Set());
  const [startRipples, setStartRipples] = useState(new Set());
  const { connection, workspaces } = dashboard;
  const commands = workspaceCommands(dashboard.commands, workspace.id);
  const visible = commands;
  const events = dashboard.events.filter((e) => commands.some((c) => c.id === e.processId));
  const cwd = workspace.workingDirectory;
  useEffect(() => {
    remember(`pdash.view.${workspace.id}`, { panes: views, layout });
  }, [views, layout, workspace.id]);
  const fail = (e) => setToast(e.message || String(e));
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  async function action(id, type) {
    setBusy((b) => new Set([...b, id]));
    if (type === 'start' || type === 'restart') {
      setLaunching((ids) => new Set([...ids, id]));
      setStartRipples((ids) => new Set([...ids, id]));
    }
    try {
      await api(`/commands/${id}/${type}`, 'POST');
    } catch (e) {
      fail(e);
    } finally {
      setBusy((b) => new Set([...b].filter((x) => x !== id)));
      setLaunching((ids) => new Set([...ids].filter((x) => x !== id)));
    }
  }
  async function batch(type) {
    await Promise.all(visible.map((c) => action(c.id, type)));
  }
  async function remove(c) {
    try {
      await api(`/commands/${c.id}`, 'DELETE');
      setDialog(null);
    } catch (e) {
      fail(e);
    }
  }
  return (
    <div className={`app-shell ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="sidebar-header">
          {sidebarExpanded && (
            <div className="brand">
              <span className="brand-mark"><TerminalSquare size={21} /></span>
              p-dash
            </div>
          )}
        <button className="icon sidebar-toggle" onClick={onToggleSidebar}
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={sidebarExpanded}>
          {sidebarExpanded ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}
        </button>
        </div>
        {!sidebarExpanded ? (
          <div className="sidebar-rail">
            <WorkspacePicker workspace={workspace} workspaces={workspaces} onSwitch={onSwitch} compact />
            <button className="icon" aria-label="Workspace settings" title="Workspace settings"
              onClick={() => setDialog({ type: 'workspace', workspace })}><Pencil size={17} /></button>
            <button className="icon" aria-label="New workspace" title="New workspace"
              onClick={() => setDialog({ type: 'workspace' })}><Folder size={17} /></button>
            <button className="icon" aria-label="Add command" title="Add command"
              onClick={() => setDialog({ type: 'command' })}><Plus size={18} /></button>
          </div>
        ) : <>
        <div className="workspace-switcher" style={{ '--workspace-accent': workspace.color }}>
          <div className="section-label">
            WORKSPACE
          </div>
          <WorkspacePicker workspace={workspace} workspaces={workspaces} onSwitch={onSwitch} />
          <p className="workspace-description">
            {workspace.description || 'Workspace description not set.'}
          </p>
          <div className="workspace-actions">
            <button
              className="text-button"
              onClick={() => setDialog({ type: 'workspace', workspace })}
            >
              <Pencil size={13} />
              Settings
            </button>
            <button className="text-button" onClick={() => setDialog({ type: 'workspace' })}>
              <Plus size={13} />
              New
            </button>
          </div>
        </div>
        <button className="nav-item" onClick={() => setDialog({ type: 'command' })}>
          <Plus size={17} />
          Add command
        </button>
        <p className="sidebar-hint">
          {commands.filter((c) => c.alive).length} active process{commands.filter((c) => c.alive).length === 1 ? '' : 'es'}
        </p>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className={`dot ${connection === 'live' ? 'running' : ''}`} />
            <span>
              {connection === 'live'
                ? 'Server connected'
                : connection === 'connecting'
                  ? 'Connecting…'
                  : 'Reconnecting…'}
            </span>
          </div>
          <div className="sidebar-footer">
            p-dash <span>v2.0.0</span>
          </div>
        </div>
        </>}
      </aside>
      <main>
        <section className="process-section">
          <div className="section-toolbar">
            <div>
              <h2>Commands</h2>
              <span className="count">{visible.length}</span>
            </div>
            <div>
              <button
                className="text-button"
                disabled={!visible.length || connection !== 'live'}
                onClick={() => batch('start')}
              >
                <Play size={13} />
                Start all
              </button>
              <button
                className="text-button"
                disabled={
                  !visible.length || connection !== 'live' || visible.some((c) => busy.has(c.id))
                }
                onClick={() => batch('restart')}
              >
                <RotateCcw size={13} />
                Restart all
              </button>
              <span className="divider" />
              <button
                className="text-button"
                disabled={!visible.some(active)}
                onClick={() => batch('stop')}
              >
                <Square size={12} />
                Stop all
              </button>
            </div>
          </div>
          <div className="command-grid">
            {visible.map((c) => (
              <article
                key={c.id}
                className={`command-card ${tab === c.id ? 'focused' : ''} ${c.status === 'starting' || launching.has(c.id) ? 'starting' : ''} ${startRipples.has(c.id) ? 'start-ripple' : ''}`}
                style={{ '--accent': c.color }}
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget && event.animationName === 'command-start-ripple') {
                    setStartRipples((ids) => new Set([...ids].filter((id) => id !== c.id)));
                  }
                }}
              >
                <div className="card-top">
                  <button className="command-name" onClick={() => setTab(c.id)}>
                    <span className="process-symbol">
                      <TerminalSquare size={16} />
                    </span>
                    <strong>{c.name}</strong>
                  </button>
                  <span className={`status ${c.status}`}>
                    <span className={`dot ${c.status}`} />
                    {statusLabel(c.status)}
                  </span>
                </div>
                <code title={c.command.join(' ')}>{c.command.join(' ')}</code>
                <div className="card-path" title={c.cwd}>
                  <Folder size={12} />
                  {c.cwd.replaceAll('\\', '/').split('/').filter(Boolean).slice(-2).join('/')}
                </div>
                <div className="card-bottom">
                  <span className="runtime">
                    {active(c) ? (
                      <>
                        <span className="pulse-bars">▂▅▃▆▂</span>
                        {ago(c.startedAt)}
                        <span className="pid">PID {c.pid}</span>
                      </>
                    ) : c.exitCode != null ? (
                      `Exit ${c.exitCode} · ${ago(c.endedAt)} ago`
                    ) : (
                      'Not started'
                    )}
                  </span>
                  <div className="card-actions">
                    <button
                      className="icon"
                      disabled={busy.has(c.id) || connection !== 'live'}
                      title="Edit command"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => setDialog({ type: 'command', command: c })}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      className="icon"
                      disabled={busy.has(c.id)}
                      aria-label={`Restart ${c.name}`}
                      onClick={() => action(c.id, 'restart')}
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      className={`icon ${active(c) ? 'stop' : 'play'}`}
                      disabled={busy.has(c.id) || connection !== 'live'}
                      aria-label={`${active(c) ? 'Stop' : 'Start'} ${c.name}`}
                      onClick={() => action(c.id, active(c) ? 'stop' : 'start')}
                    >
                      {active(c) ? <Square size={13} /> : <Play size={14} />}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!visible.length && (
              <button className="empty-card" onClick={() => setDialog({ type: 'command' })}>
                <span>
                  <Plus size={24} />
                </span>
                  <strong>No commands configured.</strong>
                  <small>Add a command to run a process.</small>
              </button>
            )}
          </div>
        </section>
        <div className="log-views" style={grid.style}>
          {views.map((view, index) => (
            <LogView key={view.id} view={view} index={index} style={grid.panes[view.id]} commands={commands} events={events}
              isActive={view.id === activePane} onActivate={() => setActivePane(view.id)}
              onChange={(patch) => setViews((current) => updatePane(current, view.id, patch))}
              onSplit={(direction) => {
                const id = crypto.randomUUID();
                setViews((current) => splitPane(current, view.id, id));
                setLayout((current) => splitLayout(current, view.id, id, direction));
                setActivePane(id);
              }}
              canClose={views.length > 1} onClose={() => {
                setViews((current) => current.filter((pane) => pane.id !== view.id));
                setLayout((current) => closeLayout(current, view.id));
                if (activePane === view.id) setActivePane(views.find((pane) => pane.id !== view.id).id);
              }} setToast={setToast} />
          ))}
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button className="icon" aria-label="Dismiss" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {dialog?.type === 'command' && (
        <CommandDialog
          command={dialog.command ? commands.find((c) => c.id === dialog.command.id) || dialog.command : undefined}
          cwd={cwd}
          onClose={() => setDialog(null)}
          onDelete={() => setDialog({ type: 'delete', command: dialog.command })}
          onSave={(body) =>
            api(
              dialog.command ? `/commands/${dialog.command.id}` : '/commands',
              dialog.command ? 'PATCH' : 'POST',
              { ...body, workspaceId: workspace.id },
            )
          }
        />
      )}{' '}
      {dialog?.type === 'workspace' && (
        <WorkspaceDialog
          workspace={dialog.workspace}
          cwd={cwd}
          commandCount={commands.length}
          hasActiveCommands={commands.some((c) => c.alive || active(c))}
          onClose={() => setDialog(null)}
          onSaved={(w) => onSwitch(w.id)}
          onDeleted={() => onSwitch('default')}
        />
      )}
      {dialog?.type === 'delete' && (
        <div className="overlay">
          <section className="dialog small" role="dialog" aria-modal="true">
            <h2>Delete {dialog.command.name}?</h2>
            <p className="muted">This removes its saved command definition.</p>
            <div className="dialog-actions">
              <button onClick={() => setDialog({ type: 'command', command: dialog.command })}>
                Cancel
              </button>
              <button className="danger" onClick={() => remove(dialog.command)}>
                Delete command
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
