import { useEffect, useState } from 'react';
import { api } from './client.js';
import { retainEvents } from '../ui.js';

/** One reconnecting WebSocket carries replay + live output. HTTP controls share the same services. */
export function useDashboard(onMessage) {
  const [commands, setCommands] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [events, setEvents] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [cwd, setCwd] = useState('');
  useEffect(() => {
    let disposed = false,
      socket,
      retry,
      heartbeat,
      cursor = 0;
    const stateEvent = (event) => {
      if (event.type === 'state')
        setCommands((prev) =>
          prev.some((c) => c.id === event.processId)
            ? prev.map((c) => (c.id === event.processId ? event.process : c))
            : [...prev, event.process],
        );
      if (event.type === 'workspaces') setWorkspaces(event.workspaces);
      if (event.type === 'removed')
        setCommands((prev) => prev.filter((c) => c.id !== event.processId));
    };
    const ingest = (event) => {
      if (event.type === 'pong') return;
      if (event.type === 'snapshot') {
        setCommands(event.commands);
        setWorkspaces(event.workspaces);
        const reset = event.seq < cursor;
        setEvents((prev) =>
          retainEvents(
            reset
              ? event.events
              : [...prev, ...event.events.filter((e) => e.seq > (prev.at(-1)?.seq || 0))],
          ),
        );
        for (const entry of event.events) if (entry.seq > event.stateCursor) stateEvent(entry);
        if (event.truncated) onMessage('Older output expired. Showing retained history.');
        cursor = event.seq;
      } else if (event.seq > cursor) {
        setEvents((prev) => retainEvents([...prev, event]));
        stateEvent(event);
        cursor = event.seq;
      }
    };
    const reconnect = () => {
      clearInterval(heartbeat);
      if (!disposed) {
        setConnection('reconnecting');
        retry = setTimeout(connect, 1500);
      }
    };
    async function connect() {
      try {
        const status = await api('/status');
        const { ticket } = await api('/terminal-ticket', 'POST');
        if (disposed) return;
        setCwd(status.cwd);
        socket = new WebSocket(
          `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/terminal/${ticket}`,
        );
        socket.onopen = () => {
          setConnection('live');
          socket.send(JSON.stringify({ type: 'subscribe', after: cursor }));
          heartbeat = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
          }, 20000);
        };
        socket.onmessage = (message) => {
          try {
            ingest(JSON.parse(message.data));
          } catch {
            onMessage('Unable to read a terminal event. Reconnecting.');
            socket.close();
          }
        };
        socket.onclose = reconnect;
        socket.onerror = () => socket.close();
      } catch {
        reconnect();
      }
    }
    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(heartbeat);
      socket?.close();
    };
  }, []);
  return { commands, workspaces, events, connection, cwd };
}
