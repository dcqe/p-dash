import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client.js';
export default function WorkspaceDialog({ workspace, cwd, empty, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(
    workspace || { name: '', description: '', color: '#5B8FF9', workingDirectory: cwd },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteBlocked = workspace?.id === 'default'
    ? 'Default is required for commands created without a workspace and cannot be deleted.'
    : !empty ? 'Remove all commands from this workspace before deleting it.' : '';
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
            Default directory for new commands. Existing commands are unchanged. Switching workspaces
            does not stop processes.
          </p>
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
                  Permanently remove this workspace and its settings. Commands must be removed
                  first.
                </p>
              </div>
              {!confirmDelete ? (
                <span className="workspace-delete-control" tabIndex={deleteBlocked ? 0 : undefined}
                  aria-describedby={deleteBlocked ? 'workspace-delete-reason' : undefined}>
                <button
                  type="button"
                  className="danger-outline"
                  disabled={busy || !!deleteBlocked}
                  aria-describedby={deleteBlocked ? 'workspace-delete-reason' : undefined}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete workspace
                </button>
                {deleteBlocked && <span id="workspace-delete-reason" className="workspace-delete-tooltip" role="tooltip">
                  {deleteBlocked}
                </span>}
                </span>
              ) : (
                <div className="workspace-delete-confirm">
                  <span>Are you sure? This cannot be undone.</span>
                  <div>
                    <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                    <button type="button" className="danger" disabled={busy || !!deleteBlocked} onClick={remove}>
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
