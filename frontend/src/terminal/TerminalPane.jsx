import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { CombinedLines } from './combined.js';
import { api } from '../api/client.js';
import { plain } from '../ui.js';
export default function TerminalPane({ events, commands, processId, query, paused, onError }) {
  const combined = useRef(new CombinedLines());
  const host = useRef();
  const terminal = useRef();
  const rendered = useRef(0);
  const initialized = useRef(false);
  const queue = useRef(Promise.resolve());
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
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 12000,
      convertEol: true,
      theme: {
        background: '#121212',
        foreground: '#c2c2c2',
        cursor: '#dddddd',
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
    terminal.current = term;
    rendered.current = 0;
    initialized.current = false;
    let resizeTimer;
    const resize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        try {
          fit.fit();
          if (processId)
            api(`/commands/${processId}/resize`, 'POST', {
              cols: term.cols,
              rows: term.rows,
            }).catch(onError);
        } catch {}
      }, 100);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    resize();
    const subscription = term.onData((data) => {
      if (processId)
        queue.current = queue.current
          .then(() => api(`/commands/${processId}/input`, 'POST', { data }))
          .catch(onError);
    });
    return () => {
      clearTimeout(resizeTimer);
      subscription.dispose();
      observer.disconnect();
      term.dispose();
      terminal.current = null;
    };
  }, [processId]);
  useEffect(() => {
    terminal.current?.reset();
    rendered.current = 0;
    initialized.current = false;
    combined.current = new CombinedLines();
  }, [query, commands.map((c) => `${c.id}:${c.name}:${c.color}`).join(',')]);
  useEffect(() => {
    const term = terminal.current;
    if (!term || paused) return;
    const fresh = matching.filter((e) => e.seq > rendered.current);
    if (!initialized.current && !matching.length) {
      term.writeln(
        '\x1b[38;2;115;115;115m  No output. Start a command to view output.\x1b[0m\r\n',
      );
      initialized.current = true;
    }
    if (fresh.length && rendered.current === 0) term.reset();
    for (const event of fresh) {
      if (processId) term.write(event.data);
      else {
        const c = processes.current.find((c) => c.id === event.processId);
        const rgb = (c?.color || '#bcbcbc').match(/\w\w/g).map((n) => parseInt(n, 16));
        const lines = combined.current
          .push(`${event.processId}:${event.runId}`, event.data)
          .filter((line) => !query || plain(line).toLowerCase().includes(query.toLowerCase()));
        for (const line of lines)
          term.writeln(
            `\x1b[0m${/^\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/.test(plain(line).trim()) ? '' : `\x1b[38;2;105;105;105m${new Date(event.time).toLocaleTimeString('en-GB')}\x1b[0m  `}\x1b[38;2;${rgb.join(';')}m${(c?.name || 'process').padEnd(17)}\x1b[0m  ${line}\x1b[0m`,
          );
      }
    }
    if (fresh.length) {
      rendered.current = fresh.at(-1).seq;
      initialized.current = true;
    }
  }, [events, paused, query, commands, processId]);
  return (
    <div
      className="terminal-host"
      ref={host}
      aria-label={processId ? 'Interactive terminal' : 'Combined terminal output'}
    />
  );
}
