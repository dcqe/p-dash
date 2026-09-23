import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
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
  Trash2,
  X,
} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import './style.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import { CombinedLines } from './combined.js';

let token;
async function api(route, method = 'GET', body) {
  if (!token) {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('Could not establish local session');
    token = (await response.json()).token;
  }
  const res = await fetch('/api' + route, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
// Neutral UI accents keep the control room monochrome; terminal ANSI colors stay intact.
const palette = ['#d6d8d4', '#b8bbb6', '#969a95', '#e4e5e2', '#7c817b'];
const active = (c) => ['starting', 'running', 'stopping'].includes(c.status);
const ago = (t) => {
  if (!t) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(t)) / 1000));
  return s < 60
    ? `${s}s`
    : s < 3600
      ? `${Math.floor(s / 60)}m ${s % 60}s`
      : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};
const plain = (s) =>
  s
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
function retainEvents(events) {
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

function TerminalPane({ events, commands, processId, query, paused, onError }) {
  const combined = useRef(new CombinedLines());
  const host = useRef();
  const terminal = useRef();
  const rendered = useRef(0);
  const initialized = useRef(false);
  const queue = useRef(Promise.resolve());
  const processes = useRef(commands);
  processes.current = commands;
  const matching = processId
    ? events.filter((e) => e.processId === processId && e.type === 'output')
    : events.filter((e) => e.type === 'output' && commands.some((c) => c.id === e.processId));
  useEffect(() => {
    const term = new Terminal({
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.65,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 12000,
      convertEol: true,
      theme: {
        background: '#111513',
        foreground: '#bec8bf',
        cursor: '#b9e88b',
        selectionBackground: '#394c37',
        black: '#59645d',
        red: '#f08b89',
        green: '#a5d87a',
        yellow: '#e9c078',
        blue: '#9ba9ff',
        magenta: '#d6a1d9',
        cyan: '#78cbd0',
        white: '#e6eae2',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    terminal.current = term;
    rendered.current = 0;
    initialized.current = false;
    let resizeTimer;
    const resize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fit.fit();
          if (processId)
            api(`/commands/${processId}/resize`, 'POST', {
              cols: term.cols,
              rows: term.rows,
            }).catch(onError);
        } catch {}
      }, 100);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    const subscription = term.onData((data) => {
      if (processId)
        queue.current = queue.current
          .then(() => api(`/commands/${processId}/input`, 'POST', { data }))
          .catch(onError);
    });
    return () => {
      clearTimeout(resizeTimer);
      subscription.dispose();
      observer.disconnect();
      term.dispose();
      terminal.current = null;
    };
  }, [processId]);
  useEffect(() => {
    terminal.current?.reset();
    rendered.current = 0;
    initialized.current = false;
    combined.current = new CombinedLines();
  }, [query, commands.map((c) => c.id).join(',')]);
  useEffect(() => {
    const term = terminal.current;
    if (!term || paused) return;
    const fresh = matching.filter((e) => e.seq > rendered.current);
    if (!initialized.current && !matching.length) {
      term.writeln(
        '\x1b[38;2;104;122;108m  Waiting for output. Start a command to bring this space to life.\x1b[0m\r\n',
      );
      initialized.current = true;
    }
    if (fresh.length && rendered.current === 0) term.reset();
    for (const event of fresh) {
      if (processId) term.write(event.data);
      else {
        const c = processes.current.find((c) => c.id === event.processId);
        const rgb = (c?.color || '#a5d87a').match(/\w\w/g).map((n) => parseInt(n, 16));
        const lines = combined.current
          .push(`${event.processId}:${event.runId}`, event.data)
          .filter((line) => !query || plain(line).toLowerCase().includes(query.toLowerCase()));
        for (const line of lines)
          term.writeln(
            `\x1b[0m${/^\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/.test(line) ? '' : `\x1b[38;2;94;113;100m${new Date(event.time).toLocaleTimeString('en-GB')}\x1b[0m  `}\x1b[38;2;${rgb.join(';')}m${(c?.name || 'process').padEnd(17)}\x1b[0m  ${line}\x1b[0m`,
          );
      }
    }
    if (fresh.length) {
      rendered.current = fresh.at(-1).seq;
      initialized.current = true;
    }
  }, [events, paused, query, commands, processId]);
  return (
    <div
      className="terminal-host"
      ref={host}
      aria-label={processId ? 'Interactive terminal' : 'Combined terminal output'}
    />
  );
}

function CommandDialog({ command, cwd, onClose, onSave }) {
  const [form, setForm] = useState(
    command
      ? { name: command.name, command: command.command, cwd: command.cwd, color: command.color }
      : { name: '', command: '', cwd, color: palette[0] },
  );
  const [env, setEnv] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form };
      if (env.trim()) body.env = JSON.parse(env);
      await onSave(body);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">
          <div>
            <span className="eyebrow">COMMAND CONFIGURATION</span>
            <h2 id="command-title">{command ? 'Edit command' : 'Make room for a new process.'}</h2>
          </div>
          <button className="icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Name
            <input autoFocus required placeholder="orders-service" {...field('name')} />
          </label>
          <label>
            Command
            <textarea
              required
              rows="3"
              placeholder="mvn -pl orders -am quarkus:dev"
              {...field('command')}
            />
          </label>
          <label>
            Working directory
            <input required placeholder="Absolute path to your project" {...field('cwd')} />
          </label>
          <label>
            Environment overrides{' '}
            <span className="muted">
              JSON · optional{command ? ' · blank preserves existing values' : ''}
            </span>
            <textarea
              rows="2"
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              placeholder={'{"JAVA_HOME": "…", "QUARKUS_HTTP_PORT": "8081"}'}
            />
          </label>
          <div className="swatches">
            {palette.map((color) => (
              <button
                type="button"
                key={color}
                aria-label={`Use color ${color}`}
                className={form.color === color ? 'chosen' : ''}
                style={{ background: color }}
                onClick={() => setForm({ ...form, color })}
              >
                {form.color === color && <Check size={15} />}
              </button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save command'}
              <ChevronRight size={15} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function GroupDialog({ commands, group, onClose, onSave, onDelete }) {
  const [name, setName] = useState(group?.name || '');
  const [ids, setIds] = useState(group?.processIds || []);
  const [error, setError] = useState('');
  return (
    <div className="overlay">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="group-title">
        <div className="dialog-title">
          <h2 id="group-title">{group ? 'Edit' : 'Create'} command group</h2>
          <button className="icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await onSave({ name, processIds: ids });
              onClose();
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <label>
            Group name
            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Backend services"
            />
          </label>
          <p className="muted">Observe these commands together in one terminal.</p>
          <div className="group-options">
            {commands.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(c.id)}
                  onChange={(e) =>
                    setIds(e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id))
                  }
                />
                <span style={{ color: c.color }}>●</span>
                {c.name}
              </label>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="dialog-actions">
            {group && (
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  try {
                    await onDelete();
                    onClose();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Delete group
              </button>
            )}
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary">Save group</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function App() {
  const [commands, setCommands] = useState([]);
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState('all');
  const [tab, setTab] = useState('combined');
  const [connection, setConnection] = useState('connecting');
  const [cwd, setCwd] = useState('');
  const [query, setQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(new Set());
  const [agent, setAgent] = useState(false);
  const [tick, setTick] = useState(0);
  const cursor = useRef(0);
  const scrollArea = useRef();
  const fail = (e) => setToast(e.message || String(e));
  useEffect(() => {
    const t = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const ingest = (event) => {
      if (event.type === 'snapshot') {
        setCommands(event.commands);
        setGroups(event.groups);
        const reset = event.seq < cursor.current;
        setEvents((prev) =>
          retainEvents(
            reset
              ? event.events
              : [...prev, ...event.events.filter((e) => e.seq > (prev.at(-1)?.seq || 0))],
          ),
        );
        cursor.current = event.seq;
        if (event.truncated)
          setToast('Older output expired from retention. Showing available history.');
      } else {
        setEvents((prev) => retainEvents([...prev, event]));
        if (event.type === 'state')
          setCommands((prev) =>
            prev.some((c) => c.id === event.processId)
              ? prev.map((c) => (c.id === event.processId ? event.process : c))
              : [...prev, event.process],
          );
        if (event.type === 'groups') setGroups(event.groups);
        if (event.type === 'removed')
          setCommands((prev) => prev.filter((c) => c.id !== event.processId));
      }
      cursor.current = Math.max(cursor.current, event.seq || 0);
    };
    (async () => {
      while (!cancelled) {
        try {
          const status = await api('/status');
          if (cancelled) break;
          setCwd(status.cwd);
          const response = await fetch(`/api/events?after=${cursor.current}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (!response.ok) {
            token = null;
            throw new Error('Connection rejected');
          }
          setConnection('live');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let index;
            while ((index = buffer.indexOf('\n\n')) >= 0) {
              const frame = buffer.slice(0, index);
              buffer = buffer.slice(index + 2);
              const line = frame.split('\n').find((l) => l.startsWith('data: '));
              if (line) ingest(JSON.parse(line.slice(6)));
            }
          }
        } catch (e) {
          if (cancelled) break;
        }
        if (!cancelled) {
          setConnection('reconnecting');
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);
  const group = groups.find((g) => g.id === selected);
  const visible = group ? commands.filter((c) => group.processIds.includes(c.id)) : commands;
  const running = commands.filter(active).length;
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
            setAgent(false);
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
              setAgent(false);
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
        <button className="mobile-agent text-button" onClick={() => setAgent(true)}>
          <Code2 size={14} />
          Agent access
        </button>
        <div className="sidebar-bottom">
          <div className="agent-card">
            <span className="agent-icon">
              <Code2 size={19} />
            </span>
            <strong>Built for your AI, too.</strong>
            <p>
              The same controls.
              <br />
              One local API.
            </p>
            <button onClick={() => setAgent(true)}>
              Connect an agent
              <ArrowUpRight size={14} />
            </button>
          </div>
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
            p-dash <span>v0.1.0</span>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{agent ? 'Agent connection' : group?.name || 'All commands'}</strong>
          </div>
          <span className="host-label">
            <Radio size={13} />
            127.0.0.1<span className="key-label">LOCAL ONLY</span>
          </span>
        </header>
        {agent ? (
          <section className="agent-page">
            <span className="eyebrow">HUMANS & AGENTS, SAME CONTROL ROOM</span>
            <h1>Your agent has a seat here.</h1>
            <p>
              Start and stop services, inspect output, send terminal input, and manage groups
              through the same local API.
            </p>
            <div className="agent-doc">
              <h2>MCP · stdio</h2>
              <p>Add this server to your agent’s MCP configuration. Keep p-dash running.</p>
              <pre>
                {JSON.stringify(
                  {
                    mcpServers: {
                      'p-dash': {
                        command: 'node',
                        args: [cwd.replaceAll('\\', '/') + '/bin/mcp.js'],
                      },
                    },
                  },
                  null,
                  2,
                )}
              </pre>
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(
                      JSON.stringify(
                        {
                          mcpServers: {
                            'p-dash': {
                              command: 'node',
                              args: [cwd.replaceAll('\\', '/') + '/bin/mcp.js'],
                            },
                          },
                        },
                        null,
                        2,
                      ),
                    )
                    .then(() => setToast('MCP configuration copied'))
                    .catch(fail)
                }
              >
                <Copy size={14} />
                Copy configuration
              </button>
              <h2>CLI · machine-readable JSON</h2>
              <pre>
                node bin/pdash.js status{'\n'}node bin/pdash.js start &lt;command-id&gt;{'\n'}node
                bin/pdash.js logs &lt;command-id&gt; &lt;cursor&gt;{'\n'}node bin/pdash.js watch
              </pre>
              <p>
                REST authentication: <code>Authorization: Bearer &lt;token&gt;</code>. Find the
                token in <code>.pdash/token</code>. Read the complete contract in{' '}
                <code>docs/api.md</code>.
              </p>
              <div className="agent-note">
                <Check size={16} />
                Resumable output cursors · shared process ownership · explicit targets
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="page-heading">
              <div>
                <div className="eyebrow">
                  <span className="tiny-line" />
                  YOUR LOCAL CONTROL ROOM
                </div>
                <h1>{group?.name || 'All systems. One view.'}</h1>
                <p>Less terminal juggling. More building.</p>
              </div>
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
                <button className="primary" onClick={() => setDialog({ type: 'command' })}>
                  <Plus size={17} />
                  New command
                </button>
              </div>
            </section>
            <section className="metrics">
              <div>
                <span className="metric-icon green">
                  <Activity size={18} />
                </span>
                <div>
                  <strong>{running.toString().padStart(2, '0')}</strong>
                  <span>Running</span>
                </div>
                <span className="metric-caption">
                  {running ? 'Processes alive' : 'Ready when you are'}
                </span>
              </div>
              <div>
                <span className="metric-icon">
                  <Square size={16} />
                </span>
                <div>
                  <strong>{(commands.length - running).toString().padStart(2, '0')}</strong>
                  <span>Inactive</span>
                </div>
                <span className="metric-caption">Stopped or exited</span>
              </div>
              <div>
                <span className="metric-icon purple">
                  <Layers size={18} />
                </span>
                <div>
                  <strong>{groups.length.toString().padStart(2, '0')}</strong>
                  <span>Groups</span>
                </div>
                <span className="metric-caption">Organized your way</span>
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
                        {c.status}
                      </span>
                    </div>
                    <code title={c.command}>{c.command}</code>
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
                        <button
                          className="icon delete-action"
                          disabled={active(c)}
                          aria-label={`Delete ${c.name}`}
                          onClick={() => setDialog({ type: 'delete', command: c })}
                        >
                          <Trash2 size={12} />
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
                      <span className="dot" style={{ background: c.color }} />
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
          </>
        )}
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
              <button onClick={() => setDialog(null)}>Cancel</button>
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
createRoot(document.getElementById('root')).render(<App />);
