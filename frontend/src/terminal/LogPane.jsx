import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CombinedLines } from './combined.js';
import { plain } from '../ui.js';
import { lastTerminalLines } from './output.js';
const CLEAR_SCREEN = '\x1b[?25l\x1b[0m\x1b[2J\x1b[3J\x1b[H';

export default forwardRef(function LogPane(
  { events, commands, processId, query, paused, clearAfter = null, onError, onViewportChange },
  ref,
) {
  const combined = useRef(new CombinedLines());
  const host = useRef();
  const terminal = useRef();
  const viewportCallback = useRef(onViewportChange);
  viewportCallback.current = onViewportChange;
  const followRequested = useRef(false);
  useImperativeHandle(
    ref,
    () => ({
      getLines: (count) => lastTerminalLines(terminal.current?.buffer.active, count),
      scrollToBottom: () => {
        followRequested.current = true;
        terminal.current?.scrollToBottom();
        viewportCallback.current?.(true);
      },
    }),
    [],
  );
  const rendered = useRef(0);
  const initialized = useRef(false);
  const hasLine = useRef(false);
  const processes = useRef(commands);
  processes.current = commands;
  const matching = processId
    ? events.filter((e) => e.processId === processId && e.type === 'output')
    : events.filter((e) => e.type === 'output' && commands.some((c) => c.id === e.processId));
  useEffect(() => {
    const term = new Terminal({
      fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
      fontSize: 12,
      lineHeight: 1.65,
      disableStdin: true,
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      scrollback: 12000,
      convertEol: true,
      theme: {
        background: '#121212',
        foreground: '#c2c2c2',
        selectionBackground: '#444444',
        black: '#606060',
        red: '#f08b89',
        green: '#a5d87a',
        yellow: '#e9c078',
        blue: '#9ba9ff',
        magenta: '#d6a1d9',
        cyan: '#78cbd0',
        white: '#e8e8e8',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    term.write('\x1b[?25l');
    term.attachCustomKeyEventHandler((event) => {
      if (
        event.type === 'keydown' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'c'
      ) {
        if (term.hasSelection()) {
          event.preventDefault();
          navigator.clipboard.writeText(term.getSelection()).catch(onError);
        }
        return false;
      }
      return true;
    });
    terminal.current = term;
    viewportCallback.current?.(true);
    let resizing = false;
    let viewportAtBottom = true;
    const scrollListener = term.onScroll(() => {
      if (!followRequested.current && !resizing) {
        const buffer = term.buffer.active;
        viewportAtBottom = buffer.viewportY === buffer.baseY;
        viewportCallback.current?.(viewportAtBottom);
      } else if (followRequested.current) {
        viewportAtBottom = true;
      }
    });
    rendered.current = 0;
    initialized.current = false;
    hasLine.current = false;
    let resizeTimer;
    const resize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizing = true;
        try {
          fit.fit();
          if (viewportAtBottom) term.scrollToBottom();
        } catch {} finally {
          resizing = false;
        }
      }, 100);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    return () => {
      clearTimeout(resizeTimer);
      observer.disconnect();
      scrollListener.dispose();
      term.dispose();
      terminal.current = null;
    };
  }, [processId]);
  useEffect(() => {
    // Queue the clear after pending writes so old output cannot reappear afterward.
    terminal.current?.write(CLEAR_SCREEN);
    rendered.current = clearAfter ?? 0;
    initialized.current = clearAfter !== null;
    combined.current = new CombinedLines();
    hasLine.current = false;
  }, [query, clearAfter, commands.map((c) => `${c.id}:${c.name}:${c.color}`).join(',')]);
  useEffect(() => {
    const term = terminal.current;
    if (!term || paused) return;
    const fresh = matching.filter((e) => e.seq > rendered.current);
    if (!initialized.current && !matching.length) {
      term.write('\x1b[38;2;115;115;115m  No output. Start a command to view output.\x1b[0m');
      initialized.current = true;
    }
    if (fresh.length && rendered.current === 0) {
      term.write(CLEAR_SCREEN);
      hasLine.current = false;
    }
    const appendLine = (line) => {
      term.write(`${hasLine.current ? '\r\n' : ''}${line}`);
      hasLine.current = true;
    };
    const nameWidth = commands.reduce((width, c) => Math.max(width, (c.name || 'process').length), 0);
    for (const event of fresh) {
      const c = processes.current.find((c) => c.id === event.processId);
      const rgb = (c?.color || '#bcbcbc').match(/\w\w/g).map((n) => parseInt(n, 16));
      const lines = combined.current
        .push(`${event.processId}:${event.runId}:${event.stream}`, event.data)
        .filter(
          (line) => processId || !query || plain(line).toLowerCase().includes(query.toLowerCase()),
        );
      for (const line of lines) {
        if (processId) appendLine(`${line}\x1b[0m`);
        else
          appendLine(
            `\x1b[0m${/^\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/.test(plain(line).trim()) ? '' : `\x1b[38;2;105;105;105m${new Date(event.time).toLocaleTimeString('en-GB')}\x1b[0m  `}\x1b[38;2;${rgb.join(';')}m${(c?.name || 'process').padEnd(nameWidth)}\x1b[0m  ${line}\x1b[0m`,
          );
      }
    }
    if (fresh.length) {
      rendered.current = fresh.at(-1).seq;
      initialized.current = true;
    }
    if (followRequested.current) {
      // Wait for queued output to render before following its final line.
      term.write('', () => {
        term.scrollToBottom();
        followRequested.current = false;
        viewportCallback.current?.(true);
      });
    }
  }, [events, paused, query, commands, processId, clearAfter]);
  return (
    <div
      className="terminal-host"
      ref={host}
      aria-label={processId ? 'Process log output' : 'Combined log output'}
    />
  );
});
