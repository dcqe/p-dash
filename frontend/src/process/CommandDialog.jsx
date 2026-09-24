import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { palette } from '../ui.js';
export default function CommandDialog({ command, cwd, onClose, onSave }) {
  const [form, setForm] = useState(
    command
      ? {
          name: command.name,
          command: command.command.join('\n'),
          cwd: command.cwd,
          color: command.color,
          mode: command.mode,
        }
      : { name: '', command: '', cwd, color: '', mode: 'pty' },
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
      const body = { ...form, command: form.command.split(/\r?\n/), color: form.color || undefined };
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
            Executable and arguments <span className="muted">One per line · no extra quoting</span>
            <textarea
              required
              rows="3"
              placeholder={'cmd.exe\n/d\n/s\n/c\nmvnw.cmd -pl orders -am quarkus:dev'}
              {...field('command')}
            />
          </label>
          <label>
            Terminal mode
            <select {...field('mode')}>
              <option value="pty">Interactive terminal (PTY)</option>
              <option value="pipe">Pipes (separate stdout / stderr)</option>
            </select>
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
