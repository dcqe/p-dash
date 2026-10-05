import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { statusLabel } from '../ui.js';

export default function CommandMenu({ commands, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const host = useRef();
  const trigger = useRef();
  const panelId = useId();
  const allSelected = commands.length > 0 && selected.length === commands.length;
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!host.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="command-menu" ref={host}>
      <button ref={trigger} className="command-menu-trigger" aria-expanded={open}
        aria-controls={panelId} onClick={() => setOpen(!open)}>
        Commands <ChevronDown size={12} />
      </button>
      {open && (
        <div id={panelId} className="command-menu-panel" role="group" aria-label="Terminal commands">
          <p>Show in tabs and combined stream</p>
          <label className="command-menu-all">
            <input type="checkbox" checked={allSelected} disabled={!commands.length}
              ref={(input) => {
                if (input) input.indeterminate = selected.length > 0 && !allSelected;
              }}
              onChange={() => onChange(allSelected ? [] : null)} />
            <span>Select all / none</span>
          </label>
          {commands.map((command) => (
            <label key={command.id}>
              <input type="checkbox" checked={selected.some((c) => c.id === command.id)}
                onChange={() => onChange((previous) => {
                  const ids = previous === null ? commands.map((c) => c.id) : previous;
                  return ids.includes(command.id)
                    ? ids.filter((id) => id !== command.id)
                    : [...ids, command.id];
                })} />
              <span className={`dot ${command.status}`} title={statusLabel(command.status)} />
              <span>{command.name}</span>
            </label>
          ))}
          {!commands.length && <p>No commands configured.</p>}
        </div>
      )}
    </div>
  );
}
