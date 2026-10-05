import React, { useEffect, useRef, useState } from 'react';
import {
  Eraser,
  PanelLeftClose,
  PanelLeftOpen,
  Folder,
  Layers,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  TerminalSquare,
  X,
} from 'lucide-react';
import { api } from './api/client.js';
import { useDashboard } from './api/useDashboard.js';
import { active, ago, statusLabel } from './ui.js';
import LogPane from './terminal/LogPane.jsx';
import CopyOutputButton from './terminal/CopyOutputButton.jsx';
import CommandMenu from './terminal/CommandMenu.jsx';
import CommandDialog from './process/CommandDialog.jsx';
import WorkspaceDialog from './process/WorkspaceDialog.jsx';
import WorkspacePicker from './process/WorkspacePicker.jsx';
import {
  readLastWorkspace,
  selectedWorkspace,
  readView,
  remember,
  workspaceCommands,
  streamCommands,
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
  const [tab, setTab] = useState(saved.tab);
  const [query, setQuery] = useState(saved.query);
  const [paused, setPaused] = useState(saved.paused);
  const [sources, setSources] = useState(saved.sources);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(new Set());
  const [clearedTabs, setClearedTabs] = useState({});
  const terminalRef = useRef();
  const filterInput = useRef();
  const [filterFocusRequest, setFilterFocusRequest] = useState(0);
  const { connection, workspaces } = dashboard;
  const commands = workspaceCommands(dashboard.commands, workspace.id);
  const visible = commands;
  const merged = streamCommands(commands, sources);
  const events = dashboard.events.filter((e) => commands.some((c) => c.id === e.processId));
  const cwd = workspace.workingDirectory;
  useEffect(() => {
    const focusFilter = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setTab('combined');
        setFilterFocusRequest((request) => request + 1);
      }
    };
    window.addEventListener('keydown', focusFilter, true);
    return () => window.removeEventListener('keydown', focusFilter, true);
  }, []);
  useEffect(() => {
    if (!filterFocusRequest) return;
    filterInput.current?.focus();
    filterInput.current?.select();
  }, [filterFocusRequest]);
  useEffect(() => {
    remember(`pdash.view.${workspace.id}`, { tab, query, paused, sources });
  }, [tab, query, paused, sources, workspace.id]);
  const fail = (e) => setToast(e.message || String(e));
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (tab !== 'combined' && !merged.some((c) => c.id === tab)) setTab('combined');
  }, [tab, commands, sources]);
  async function action(id, type) {
    setBusy((b) => new Set([...b, id]));
    try {
      await api(`/commands/${id}/${type}`, 'POST');
    } catch (e) {
      fail(e);
    } finally {
      setBusy((b) => new Set([...b].filter((x) => x !== id)));
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
                className={`command-card ${tab === c.id ? 'focused' : ''}`}
                style={{ '--accent': c.color }}
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
                      disabled={busy.has(c.id) || active(c)}
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
        <section className="terminal-section">
          <div className="terminal-top">
            <div className="terminal-tabs">
              <button
                className={tab === 'combined' ? 'active' : ''}
                onClick={() => setTab('combined')}
              >
                <Layers size={14} />
                Combined stream<span>{merged.length}</span>
              </button>
              {merged.map((c) => (
                <div
                  key={c.id}
                  className={`terminal-command-tab ${tab === c.id ? 'selected' : ''}`}
                >
                  <button
                    className={tab === c.id ? 'active' : ''}
                    aria-pressed={tab === c.id}
                    onClick={() => setTab(c.id)}
                    title={`Open ${c.name} logs · ${statusLabel(c.status)}`}
                  >
                    <span
                      className={`dot ${c.status}`}
                      role="img"
                      aria-label={`${c.name}: ${statusLabel(c.status)}`}
                      title={statusLabel(c.status)}
                    />
                    {c.name}
                  </button>
                </div>
              ))}
            </div>
            <div className="terminal-tools">
              <CopyOutputButton
                getLines={(count) => terminalRef.current?.getLines(count) || []}
                onMessage={setToast}
                onError={fail}
              />
              <button
                className="text-button"
                aria-label="Clear current terminal output"
                title="Clear current screen"
                onClick={() =>
                  setClearedTabs((prev) => ({
                    ...prev,
                    [tab]: dashboard.events.at(-1)?.seq || 0,
                  }))
                }
              >
                <Eraser size={15} />
                Clear
              </button>
            </div>
          </div>
          <div className="terminal-filter">
            <div className="source-legend">
              <CommandMenu commands={commands} selected={merged} onChange={setSources} />
              <span className="source-summary">{merged.length} of {commands.length} shown</span>
            </div>
            <div className="filter-actions">
                <label className={`search ${tab !== 'combined' ? 'inactive' : ''}`}>
                  <Search size={13} />
                  <input
                    ref={filterInput}
                    disabled={tab !== 'combined'}
                    aria-label="Filter combined output"
                    title="Filter output (Ctrl+F)"
                    placeholder="Filter output…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              <button
                className={`text-button pause-control ${paused ? 'paused' : ''}`}
                aria-pressed={paused}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>
          <div className="terminal-body">
            <LogPane
              ref={terminalRef}
              key={tab}
              events={events}
              commands={tab === 'combined' ? merged : visible}
              processId={tab === 'combined' ? null : tab}
              query={query}
              paused={paused}
              clearAfter={clearedTabs[tab] ?? null}
              onError={fail}
            />
          </div>
        </section>
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
          command={dialog.command}
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
          empty={!commands.length}
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
