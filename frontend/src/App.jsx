import React, { useEffect, useState } from 'react';
import {
  Download,
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
import { active, ago, plain, statusLabel } from './ui.js';
import TerminalPane from './terminal/TerminalPane.jsx';
import CommandDialog from './process/CommandDialog.jsx';
import WorkspaceDialog from './process/WorkspaceDialog.jsx';
import WorkspacePicker from './process/WorkspacePicker.jsx';
import {
  readView,
  remember,
  workspaceCommands,
  streamCommands,
} from './workspace.js';
export default function App() {
  const [toast, setToast] = useState(null);
  const dashboard = useDashboard(setToast);
  const [selected, setSelected] = useState(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => window.innerWidth >= 1280);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1280px)');
    const update = () => setSidebarExpanded(wide.matches);
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  }, []);
  const workspace = dashboard.workspaces.find((w) => w.id === selected) || dashboard.workspaces[0];
  useEffect(() => {
    if (!selected && dashboard.workspaces.length) setSelected(dashboard.workspaces[0].id);
  }, [dashboard.workspaces, selected]);
  if (!workspace)
    return (
      <div className="loading-state" role="status">
        Connecting to your workspaces…
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
  const { connection, workspaces } = dashboard;
  const commands = workspaceCommands(dashboard.commands, workspace.id);
  const visible = commands;
  const merged = streamCommands(commands, sources);
  const events = dashboard.events.filter((e) => commands.some((c) => c.id === e.processId));
  const cwd = workspace.workingDirectory;
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
    if (tab !== 'combined' && !visible.some((c) => c.id === tab)) setTab('combined');
  }, [tab, commands]);
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
  function download() {
    const text = events
      .filter(
        (e) =>
          e.type === 'output' &&
          visible.some((c) => c.id === e.processId) &&
          (tab === 'combined' ? merged.some((c) => c.id === e.processId) : tab === e.processId),
      )
      .map(
        (e) => `[${e.time}] [${commands.find((c) => c.id === e.processId)?.name}] ${plain(e.data)}`,
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'p-dash-output.log';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
            {workspace.description || 'Your commands, your space.'}
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
          {commands.filter((c) => c.alive).length} active in this workspace
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
                      'Ready to start'
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
                <strong>Your next command lives here.</strong>
                <small>Add a dev server, worker, or anything that keeps running.</small>
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
              {visible.map((c) => (
                <button
                  key={c.id}
                  className={tab === c.id ? 'active' : ''}
                  onClick={() => setTab(c.id)}
                >
                  <span
                    className={`dot process-aliveness ${c.alive ? 'alive' : 'not-alive'}`}
                    role="img"
                    aria-label={`${c.name}: ${c.alive ? 'process alive' : 'no live process'}`}
                    title={
                      c.alive
                        ? 'Process alive (readiness is shown on the command card)'
                        : 'No live process'
                    }
                  />
                  {c.name}
                </button>
              ))}
            </div>
            <div className="terminal-tools">
              <button
                className="icon"
                aria-label="Download output"
                title="Download output"
                onClick={download}
              >
                <Download size={15} />
              </button>
            </div>
          </div>
          <div className="terminal-filter">
            <div className="source-legend">
              {tab === 'combined' ? (
                <>
                  <button
                    className="source-chip"
                    aria-pressed={sources === null}
                    onClick={() => setSources(null)}
                  >
                    All
                  </button>
                  <button
                    className="source-chip"
                    onClick={() => setSources(commands.filter((c) => c.alive).map((c) => c.id))}
                  >
                    Active now
                  </button>
                  <button className="source-chip" onClick={() => setSources([])}>
                    None
                  </button>
                  {visible.map((c) => (
                    <button
                      key={c.id}
                      className={`source-chip ${merged.some((m) => m.id === c.id) ? 'included' : ''}`}
                      aria-pressed={merged.some((m) => m.id === c.id)}
                      title={`Include ${c.name} in combined stream`}
                      onClick={() =>
                        setSources((prev) => {
                          const ids = prev === null ? commands.map((c) => c.id) : prev;
                          return ids.includes(c.id)
                            ? ids.filter((id) => id !== c.id)
                            : [...ids, c.id];
                        })
                      }
                    >
                      <i style={{ background: c.color }} />
                      {c.name}
                      <span
                        className={`dot process-aliveness ${c.alive ? 'alive' : 'not-alive'}`}
                      />
                    </button>
                  ))}
                  {!merged.length && <span>Select commands to combine their output.</span>}
                </>
              ) : (
                <span>
                  Interactive PTY · keyboard input goes to{' '}
                  {commands.find((c) => c.id === tab)?.name}
                </span>
              )}
            </div>
            <div className="filter-actions">
              {tab === 'combined' && (
                <label className="search">
                  <Search size={13} />
                  <input
                    aria-label="Filter combined output"
                    placeholder="Filter output…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              )}
              <button
                className={`text-button ${paused ? 'paused' : ''}`}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
              </button>
            </div>
          </div>
          <div className="terminal-body">
            <TerminalPane
              key={tab}
              events={events}
              commands={tab === 'combined' ? merged : visible}
              processId={tab === 'combined' ? null : tab}
              query={query}
              paused={paused}
              onError={fail}
            />
          </div>
          <div className="terminal-bottom">
            <span>
              <span className={`dot ${connection === 'live' && !paused ? 'running' : ''}`} />
              {paused
                ? 'Display paused · output still captured'
                : connection === 'live'
                  ? 'Streaming live'
                  : 'Reconnecting to server'}
              <span className="terminal-meta">
                {tab === 'combined' ? 'Merged output · read only' : 'Interactive terminal'}
              </span>
            </span>
            <span>
              {events.filter((e) => e.type === 'output').length.toLocaleString()} output chunks
              <span className="terminal-meta">UTF-8</span>
            </span>
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
