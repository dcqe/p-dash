import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown } from 'lucide-react';

export default function WorkspacePicker({ workspace, workspaces, onSwitch, compact = false }) {
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const open = position !== null;
  const close = () => { setPosition(null); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector('[aria-checked="true"]')?.focus();
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target))
        setPosition(null);
    };
    const resize = () => setPosition(null);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  function toggle() {
    if (open) { close(); return; }
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const upwards = below < 180 && above > below;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      ...(upwards ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      maxHeight: Math.max(60, Math.min(360, upwards ? above : below)),
    });
  }

  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') { close(); }
    const options = [...menu.current.querySelectorAll('[role="menuitemradio"]')];
    const index = options.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % options.length;
    if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    if (next !== undefined) { event.preventDefault(); options[next]?.focus(); }
  }

  return <>
    <button ref={trigger} type="button"
      className={`workspace-picker-trigger${compact ? ' compact' : ''}`}
      style={{ '--workspace-accent': workspace.color }}
      aria-label={`Switch workspace, current: ${workspace.name}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? 'workspace-menu' : undefined}
      title={compact ? workspace.name : undefined} onClick={toggle}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (!open) toggle(); }
      }}>
      <span className="workspace-picker-avatar" aria-hidden="true">{workspace.name.slice(0, 1).toUpperCase()}</span>
      {!compact && <span className="workspace-picker-name">{workspace.name}</span>}
      <ChevronsUpDown className="workspace-picker-chevron" size={14} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={menu} id="workspace-menu" className="workspace-picker-menu" role="menu"
        aria-label="Switch workspace" style={position} onKeyDown={keys}>
        <div className="workspace-picker-heading">Switch workspace <span>{workspaces.length}</span></div>
        {workspaces.map((item) => <button key={item.id} type="button" role="menuitemradio"
          aria-checked={item.id === workspace.id} className="workspace-picker-option"
          style={{ '--workspace-accent': item.color }} onClick={() => { close(); onSwitch(item.id); }}>
          <span className="workspace-picker-avatar" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-picker-copy"><strong>{item.name}</strong>
            {item.description && <small>{item.description}</small>}</span>
          {item.id === workspace.id && <Check size={15} aria-hidden="true" />}
        </button>)}
      </div>, document.body)}
  </>;
}
