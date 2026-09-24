import React from 'react';
import { Copy, Check } from 'lucide-react';
export default function AgentConnection({ onMessage }) {
  const config = {
    mcpServers: {
      'p-dash': {
        url: location.origin + '/mcp',
        headers: { Authorization: 'Bearer <contents of .pdash/token>' },
      },
    },
  };
  return (
    <section className="agent-page">
      <span className="eyebrow">ONE APPLICATION · SHARED SERVICES</span>
      <h1>Connect your agent.</h1>
      <p>
        The MCP server is built into this Quarkus application. Your agent sees the same commands,
        terminals, and logs as this dashboard.
      </p>
      <div className="agent-doc">
        <h2>MCP · Streamable HTTP</h2>
        <p>
          Use this endpoint in an MCP client that supports HTTP. Replace the token placeholder with
          your local token. There is no separate adapter to launch.
        </p>
        <pre>{JSON.stringify(config, null, 2)}</pre>
        <button
          onClick={() =>
            navigator.clipboard
              .writeText(JSON.stringify(config, null, 2))
              .then(() =>
                onMessage('Configuration copied. Replace the token placeholder before using it.'),
              )
              .catch((e) => onMessage(e.message))
          }
        >
          <Copy size={14} />
          Copy configuration
        </button>
        <h2>Ask your agent</h2>
        <pre>
          {
            'Start the healthy demo and wait until it prints READY.\nShow new errors from the flaky demo.\nRestart all processes in the Java demos group.'
          }
        </pre>
        <p>
          <code>start_process</code>, <code>stop_process</code>, <code>get_logs</code>,{' '}
          <code>wait_for_log</code>, <code>wait_for_ready</code> and <code>wait_for_exit</code> call
          the same Java services as the web controls. More tools cover definitions, groups, input
          and resize.
        </p>
        <div className="agent-note">
          <Check size={16} />
          One Java application · no Node backend · no stdio bridge
        </div>
      </div>
    </section>
  );
}
