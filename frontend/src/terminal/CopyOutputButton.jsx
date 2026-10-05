import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Copy } from 'lucide-react';

export default function CopyOutputButton({ getLines, onMessage, onError }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState('100');
  const host = useRef();
  const panelId = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!host.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        host.current.querySelector('[aria-expanded]').focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  async function copy(amount) {
    try {
      const lines = getLines(amount);
      if (!lines.length) {
        onMessage('No output to copy.');
        return;
      }
      await navigator.clipboard.writeText(lines.join('\n'));
      setOpen(false);
      onMessage(`Copied ${lines.length} line${lines.length === 1 ? '' : 's'}.`);
    } catch (error) {
      onError(error);
    }
  }
  const valid = /^\d+$/.test(count) && Number.isSafeInteger(Number(count)) && Number(count) > 0;
  return (
    <div className="copy-output" ref={host}>
      <div className="copy-split">
        <button
          aria-label="Copy last 100 lines"
          title="Copy last 100 lines"
          onClick={() => copy(100)}
        >
          <Copy size={14} /> Copy
        </button>
        <button
          className="copy-toggle"
          aria-label="Choose number of lines to copy"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown size={12} />
        </button>
      </div>
      {open && (
        <form
          id={panelId}
          className="copy-options"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) copy(Number(count));
          }}
        >
          <label htmlFor={`${panelId}-count`}>Number of lines</label>
          <div>
            <input
              id={`${panelId}-count`}
              type="number"
              min="1"
              step="1"
              required
              autoFocus
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
            <button className="primary" type="submit" disabled={!valid}>
              <Copy size={14} /> Copy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
