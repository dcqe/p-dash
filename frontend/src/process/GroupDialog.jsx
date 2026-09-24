import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
export default function GroupDialog({ commands, group, onClose, onSave, onDelete }) {
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
