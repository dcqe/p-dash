import React, { useEffect, useRef, useState } from 'react';
import { Eraser, ArrowDownToLine, Pause, Play, Search } from 'lucide-react';
import { streamCommands } from '../workspace.js';
import LogPane from './LogPane.jsx';
import CopyOutputButton from './CopyOutputButton.jsx';
import LogViewHeader from './LogViewHeader.jsx';

export default function LogView({ view, onChange, commands, events, isActive, index, style, onActivate, onSplit, onClose, canClose, setToast }) {
  const { tab, query, sources } = view;
  const setTab = (tab) => onChange({ tab });
  const setQuery = (query) => onChange({ query });
  const setSources = (value) => onChange({ sources: typeof value === 'function' ? value(sources) : value });
  const merged = streamCommands(commands, sources);
  const [paused, setPaused] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const viewportAtBottom = useRef(true);
  const [clearedTabs, setClearedTabs] = useState({});
  const terminalRef = useRef();
  const filterInput = useRef();
  const [filterFocusRequest, setFilterFocusRequest] = useState(0);
  const fail = (e) => setToast(e.message || String(e));
  useEffect(() => {
    if (tab !== 'combined' && !commands.some((c) => c.id === tab)) setTab('combined');
  }, [tab, commands]);
  useEffect(() => {
    setPaused(false);
    setAtBottom(true);
    viewportAtBottom.current = true;
  }, [tab]);
  useEffect(() => {
    if (!isActive) return;
    const focusFilter = (event) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setTab('combined');
        setFilterFocusRequest((request) => request + 1);
      }
    };
    window.addEventListener('keydown', focusFilter, true);
    return () => window.removeEventListener('keydown', focusFilter, true);
  }, [isActive, onChange]);
  useEffect(() => {
    if (!filterFocusRequest) return;
    filterInput.current?.focus();
    filterInput.current?.select();
  }, [filterFocusRequest]);
  return (
        <section className={`terminal-section ${isActive ? 'active-pane' : ''}`}
          style={style} aria-label={`Log pane ${index + 1}`} onPointerDown={onActivate} onFocusCapture={onActivate}>
          <LogViewHeader tab={tab} commands={commands} merged={merged} onSelect={setTab}
            onSourcesChange={setSources} onSplit={onSplit} onClose={onClose} canClose={canClose} />
          <div className="terminal-toolbar" role="group" aria-label="Terminal controls">
              <button
                className="terminal-control"
                aria-label="Clear current terminal output"
                title="Clear current screen"
                onClick={() =>
                  setClearedTabs((prev) => ({
                    ...prev,
                    [tab]: events.at(-1)?.seq || 0,
                  }))
                }
              >
                <Eraser size={14} />
                Clear
              </button>
              <button
                className={`terminal-control pause-control ${paused ? 'paused' : ''}`}
                aria-pressed={atBottom ? paused : undefined}
                onClick={() => {
                  if (!atBottom) {
                    terminalRef.current?.scrollToBottom();
                    setPaused(false);
                  } else setPaused(!paused);
                }}
              >
                {!atBottom ? <ArrowDownToLine size={14} /> : paused ? <Play size={14} /> : <Pause size={14} />}
                {!atBottom ? 'Scroll down' : paused ? 'Resume' : 'Pause'}
              </button>
              <CopyOutputButton
                getLines={(count) => terminalRef.current?.getLines(count) || []}
                onMessage={setToast}
                onError={fail}
              />
              <label className={`search ${tab !== 'combined' ? 'inactive' : ''}`}>
                <Search size={14} />
                <input
                  ref={filterInput}
                  disabled={tab !== 'combined'}
                  aria-label="Filter combined output"
                  title="Filter output (Ctrl+F)"
                  placeholder="Filter output…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
          </div>
          <div className="terminal-body">
            <LogPane
              ref={terminalRef}
              key={tab}
              events={events}
              commands={tab === 'combined' ? merged : commands}
              processId={tab === 'combined' ? null : tab}
              query={query}
              paused={paused}
              onViewportChange={(bottom) => {
                if (!bottom) setPaused(true);
                else if (!viewportAtBottom.current) setPaused(false);
                viewportAtBottom.current = bottom;
                setAtBottom(bottom);
              }}
              clearAfter={clearedTabs[tab] ?? null}
              onError={fail}
            />
          </div>
        </section>
  );
}
