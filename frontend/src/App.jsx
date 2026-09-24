import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Download,
  Folder,
  Layers,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Square,
  TerminalSquare,
  X,
} from 'lucide-react';
import { api } from './api/client.js';
import { useDashboard } from './api/useDashboard.js';
import { palette, active, ago, plain, statusLabel } from './ui.js';
import TerminalPane from './terminal/TerminalPane.jsx';
import CommandDialog from './process/CommandDialog.jsx';
import GroupDialog from './process/GroupDialog.jsx';
export default function App() {
  const [selected, setSelected] = useState('all');
  const [tab, setTab] = useState('combined');

  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(new Set());

  const scrollArea = useRef();
  const { commands, groups, events, connection, cwd } = useDashboard(setToast);
  const fail = (e) => setToast(e.message || String(e));
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const group = groups.find((g) => g.id === selected);
  const visible = group ? commands.filter((c) => group.processIds.includes(c.id)) : commands;
  useEffect(() => {
    if (tab !== 'combined' && !visible.some((c) => c.id === tab)) setTab('combined');
  }, [selected, commands]);
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
          (tab === 'combined' || tab === e.processId),
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
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <TerminalSquare size={21} />
          </span>
          p-dash<span className="version">LOCAL</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">W</span>
          <div>
            <strong>My workspace</strong>
            <small>Local development</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <span className="section-label">WORKSPACE</span>
        <button
          className={`nav-item ${selected === 'all' ? 'selected' : ''}`}
          onClick={() => {
            setSelected('all');
          }}
        >
          <Layers size={17} />
          All commands<span>{commands.length}</span>
        </button>
        <div className="section-row">
          <span className="section-label">COMMAND GROUPS</span>
          <button
            className="icon"
            aria-label="Create group"
            onClick={() => setDialog({ type: 'group' })}
          >
            <Plus size={15} />
          </button>
        </div>
        {groups.map((g, i) => (
          <button
            key={g.id}
            className={`nav-item ${selected === g.id ? 'selected' : ''}`}
            onClick={() => {
              setSelected(g.id);
              setTab('combined');
            }}
          >
            <Folder size={16} style={{ color: palette[i % palette.length] }} />
            {g.name}
            <span>{g.processIds.length}</span>
          </button>
        ))}
        {!groups.length && (
          <p className="sidebar-hint">
            Keep services together.
            <br />
            Create your first group.
          </p>
        )}
        <button className="new-group" onClick={() => setDialog({ type: 'group' })}>
          <Plus size={14} />
          New group
        </button>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span className={`dot ${connection === 'live' ? 'running' : ''}`} />
            <span>
              {connection === 'live'
                ? 'Local server connected'
                : connection === 'connecting'
                  ? 'Connecting…'
                  : 'Reconnecting…'}
            </span>
          </div>
          <div className="sidebar-footer">
            p-dash <span>v2.0.0</span>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{group?.name || 'All commands'}</strong>
          </div>
          <span className="host-label">
            <Radio size={13} />
            127.0.0.1<span className="key-label">LOCAL ONLY</span>
          </span>
        </header>
            <section className="page-heading">
              <div className="heading-actions">
                {group && (
                  <button
                    className="icon"
                    title="Edit group"
                    onClick={() => setDialog({ type: 'group', group })}
                  >
                    <Pencil size={17} />
                  </button>
                )}
              </div>
            </section>
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
                      !visible.length ||
                      connection !== 'live' ||
                      visible.some((c) => busy.has(c.id))
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
                    Combined stream<span>{visible.length}</span>
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
                    visible.map((c) => (
                      <span key={c.id}>
                        <i style={{ background: c.color }} />
                        {c.name}
                      </span>
                    ))
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
                    {paused ? <Play size={12} /> : <Pause size={12} />}{' '}
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                </div>
              </div>
              <div className="terminal-body" ref={scrollArea}>
                <TerminalPane
                  key={`${selected}:${tab}`}
                  events={events}
                  commands={visible}
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
            <footer className="page-footer">
              <span>Made for the commands that keep going.</span>
              <span>
                <span className="dot running" />
                Everything stays on your machine
              </span>
            </footer>
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
              body,
            )
          }
        />
      )}{' '}
      {dialog?.type === 'group' && (
        <GroupDialog
          commands={commands}
          group={dialog.group}
          onClose={() => setDialog(null)}
          onDelete={async () => {
            await api(`/groups/${dialog.group.id}`, 'DELETE');
            setSelected('all');
          }}
          onSave={(body) =>
            api(
              dialog.group ? `/groups/${dialog.group.id}` : '/groups',
              dialog.group ? 'PUT' : 'POST',
              body,
            )
          }
        />
      )}{' '}
      {dialog?.type === 'delete' && (
        <div className="overlay">
          <section className="dialog small" role="dialog" aria-modal="true">
            <h2>Delete {dialog.command.name}?</h2>
            <p className="muted">This removes its saved definition and group memberships.</p>
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
