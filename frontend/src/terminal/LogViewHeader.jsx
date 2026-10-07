import React from 'react';
import { Columns2, Layers, Rows2, X } from 'lucide-react';
import { statusLabel } from '../ui.js';
import CommandMenu from './CommandMenu.jsx';

export default function LogViewHeader({ tab, commands, merged, onSelect, onSourcesChange, onSplit, onClose, canClose }) {
  return (
    <div className="terminal-top">
      <div className="terminal-full-navigation">
        <div className="terminal-tabs">
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
        <div className="terminal-source-tools">
          <CommandMenu commands={commands} selected={merged} onChange={onSourcesChange} />
        </div>
      </div>
      <div className="terminal-view-picker">
          <select aria-label="Select log view" value={tab} onChange={(event) => onSelect(event.target.value)}>
            <option value="combined">Combined stream ({merged.length})</option>
            {commands.map((command) => <option key={command.id} value={command.id}>{command.name}</option>)}
          </select>
      </div>
      <div className="terminal-menu-tools">
        <button className="icon" title="Split right" aria-label="Split right" onClick={() => onSplit('right')}><Columns2 size={15} /></button>
        <button className="icon" title="Split down" aria-label="Split down" onClick={() => onSplit('down')}><Rows2 size={15} /></button>
        {canClose && <button className="icon" title="Close pane" aria-label="Close pane" onClick={onClose}><X size={15} /></button>}
      </div>
    </div>
  );
}
