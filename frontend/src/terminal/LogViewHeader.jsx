import React, { useLayoutEffect, useRef, useState } from 'react';
import { Columns2, Layers, Rows2, X } from 'lucide-react';
import { statusLabel } from '../ui.js';
import CommandMenu from './CommandMenu.jsx';

export default function LogViewHeader({ tab, commands, merged, onSelect, onSourcesChange, onSplit, onClose, canClose }) {
  const [compact, setCompact] = useState(false);
  const header = useRef();
  const tabs = useRef();
  const sources = useRef();
  const actions = useRef();

  useLayoutEffect(() => {
    const measure = () => {
      const available = header.current.clientWidth - actions.current.offsetWidth;
      const required = tabs.current.scrollWidth + sources.current.offsetWidth;
      setCompact(required > available + 1);
    };
    const observer = new ResizeObserver(measure);
    [header.current, tabs.current, sources.current, actions.current].forEach((element) => observer.observe(element));
    measure();
    // Font loading can change the natural width without resizing the tab viewport.
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [commands, merged.length, canClose]);

  useLayoutEffect(() => {
    const element = tabs.current;
    const scrollTabs = (event) => {
      if (event.ctrlKey || event.metaKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) || element.scrollWidth <= element.clientWidth) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
      element.scrollLeft += event.deltaY * unit;
    };
    element.addEventListener('wheel', scrollTabs, { passive: false });
    return () => element.removeEventListener('wheel', scrollTabs);
  }, []);

  return (
    <div className={`terminal-top${compact ? ' compact-tabs' : ''}`} ref={header}>
      {/* Keep the full controls measurable while the compact selector is displayed. */}
      <div className="terminal-full-navigation" aria-hidden={compact || undefined} inert={compact}>
        <div className="terminal-tabs" ref={tabs}>
          <button className={tab === 'combined' ? 'active' : ''}
            aria-pressed={tab === 'combined'} onClick={() => onSelect('combined')}>
            <Layers size={14} />Combined stream<span>{merged.length}</span>
          </button>
          {commands.map((command) => (
            <div key={command.id} className={`terminal-command-tab ${tab === command.id ? 'selected' : ''}`}>
              <button className={tab === command.id ? 'active' : ''}
                aria-pressed={tab === command.id} onClick={() => onSelect(command.id)}
                title={`Open ${command.name} logs · ${statusLabel(command.status)}`}>
                <span className={`dot ${command.status}`} role="img"
                  aria-label={`${command.name}: ${statusLabel(command.status)}`} title={statusLabel(command.status)} />
                {command.name}
              </button>
            </div>
          ))}
        </div>
        <div className="terminal-source-tools" ref={sources}>
          <CommandMenu commands={commands} selected={merged} onChange={onSourcesChange} />
        </div>
      </div>
      {compact && (
        <div className="terminal-view-picker">
          <select aria-label="Select log view" value={tab} onChange={(event) => onSelect(event.target.value)}>
            <option value="combined">Combined stream ({merged.length})</option>
            {commands.map((command) => <option key={command.id} value={command.id}>{command.name}</option>)}
          </select>
        </div>
      )}
      <div className="terminal-menu-tools" ref={actions}>
        <button className="icon" title="Split right" aria-label="Split right" onClick={() => onSplit('right')}><Columns2 size={15} /></button>
        <button className="icon" title="Split down" aria-label="Split down" onClick={() => onSplit('down')}><Rows2 size={15} /></button>
        {canClose && <button className="icon" title="Close pane" aria-label="Close pane" onClick={onClose}><X size={15} /></button>}
      </div>
    </div>
  );
}
