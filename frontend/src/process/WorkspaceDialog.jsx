import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client.js';
export default function WorkspaceDialog({
  workspace,
  cwd,
  commandCount,
  hasActiveCommands,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [form, setForm] = useState(
    workspace || { name: '', description: '', color: '#5B8FF9', workingDirectory: cwd },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [configPath, setConfigPath] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [importText, setImportText] = useState('');
  const importInput = useRef();
  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    api(`/workspaces/${workspace.id}/config/path`)
      .then(({ path }) => { if (!cancelled) setConfigPath(path); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [workspace?.id]);

  async function configAction(action) {
    setBusy(true);
    setError('');
    try { await action(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function exportConfig() {
    const document = await api(`/workspaces/${workspace.id}/config`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2) + '\n'], { type: 'application/json' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${workspace.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importConfig(source) {
    await configAction(async () => {
      const text = typeof source === 'string' ? source : await source.text();
      let document;
      try { document = JSON.parse(text); }
      catch { throw new Error('Invalid JSON. Check the pasted text or file and try again.'); }
      const result = await api('/workspaces/import', 'POST', document);
      onSaved(result);
      onClose();
    });
  }
  const deleteBlocked =
    workspace?.id === 'default'
      ? 'Default is required for commands created without a workspace and cannot be deleted.'
      : hasActiveCommands
        ? 'Stop all commands in this workspace before deleting it.'
        : '';
  useEffect(() => {
    const key = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [busy, onClose]);
  const field = (name) => ({
    value: form[name],
    onChange: (e) => setForm({ ...form, [name]: e.target.value }),
  });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(
        workspace ? `/workspaces/${workspace.id}` : '/workspaces',
        workspace ? 'PUT' : 'POST',
        form,
      );
      onSaved(result);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(`/workspaces/${workspace.id}`, 'DELETE');
      onDeleted();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-title">
          <div>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <h2 id="workspace-title">{workspace ? 'Workspace settings' : 'New workspace'}</h2>
          </div>
          <button className="icon" aria-label="Close" disabled={busy} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={save}>
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={80}
              placeholder="Orders platform"
              {...field('name')}
            />
          </label>
          <label>
            Description
            <input
              maxLength={240}
              placeholder="Services for local development"
              {...field('description')}
            />
          </label>
          <label>
            Accent color
            <span className="color-picker-field">
              <input
                className="color-picker"
                type="color"
                aria-label="Choose accent color"
                value={form.color || '#5B8FF9'}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
              <code className="color-value">{(form.color || '#5B8FF9').toUpperCase()}</code>
            </span>
          </label>
          <label>
            Default working directory
            <input required {...field('workingDirectory')} />
          </label>
          <p className="muted">
            Default directory for new commands. Existing commands are unchanged. Switching
            workspaces does not stop processes.
          </p>
          <div className="workspace-config">
            <strong>Configuration and workspace JSON</strong>
            {workspace && <>
              <code className="workspace-config-path">{configPath || 'Loading config path…'}</code>
              <p className="muted">This config file contains all workspaces. Stop p-dash before editing it manually, then restart.</p>
            </>}
            <div className="workspace-config-actions">
              {workspace && <>
                <button type="button" disabled={busy || !configPath}
                  onClick={() => configAction(() => api(`/workspaces/${workspace.id}/config/open`, 'POST'))}>
                  Open file
                </button>
                <button type="button" disabled={busy} onClick={() => configAction(exportConfig)}>Export JSON</button>
              </>}
              <button type="button" disabled={busy} onClick={() => importInput.current.click()}>Import JSON file</button>
              <button type="button" disabled={busy} aria-expanded={showJsonImport}
                onClick={() => setShowJsonImport(!showJsonImport)}>Paste JSON</button>
                <input ref={importInput} hidden type="file" accept=".json,application/json" disabled={busy}
                  aria-label="Import workspace JSON file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) importConfig(file);
                  }} />
            </div>
            {showJsonImport && <div>
              <label>
                Workspace JSON
                <textarea autoFocus rows={8} spellCheck={false} disabled={busy}
                  placeholder="Paste exported workspace JSON here"
                  value={importText} onChange={(event) => setImportText(event.target.value)} />
              </label>
              <button type="button" disabled={busy || !importText.trim()}
                onClick={() => importConfig(importText)}>
                {busy ? 'Importing…' : 'Import pasted JSON'}
              </button>
            </div>}
            <p className="muted">Import adds a workspace with its saved commands, without starting them. Existing IDs are rejected. Export includes command environment values.</p>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {workspace && (
            <div className="workspace-delete">
              <div className="workspace-delete-copy">
                <strong>Delete workspace</strong>
                <p>
                  Permanently remove this workspace, its settings, and all {commandCount} saved
                  command{commandCount === 1 ? '' : 's'}. All commands must be stopped first.
                </p>
              </div>
              {!confirmDelete ? (
                <span
                  className="workspace-delete-control"
                  tabIndex={deleteBlocked ? 0 : undefined}
                  aria-describedby={deleteBlocked ? 'workspace-delete-reason' : undefined}
                >
                  <button
                    type="button"
                    className="danger-outline"
                    disabled={busy || !!deleteBlocked}
                    aria-describedby={deleteBlocked ? 'workspace-delete-reason' : undefined}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete workspace
                  </button>
                  {deleteBlocked && (
                    <span
                      id="workspace-delete-reason"
                      className="workspace-delete-tooltip"
                      role="tooltip"
                    >
                      {deleteBlocked}
                    </span>
                  )}
                </span>
              ) : (
                <div className="workspace-delete-confirm">
                  <span>
                    Delete this workspace and {commandCount} saved command
                    {commandCount === 1 ? '' : 's'}? This cannot be undone.
                  </span>
                  <div>
                    <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={busy || !!deleteBlocked}
                      onClick={remove}
                    >
                      {busy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save workspace'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
