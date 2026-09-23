# Architecture

## Ownership and boundaries

One Node.js daemon owns all child processes. React is a disposable client: navigation and disconnects never kill a command. Fastify exposes the same validated HTTP API to the UI, CLI and MCP stdio adapter. No database server, cloud account or background desktop runtime is needed.

Commands use node-pty (ConPTY on Windows, PTYs on Unix), not stdout pipes. Each PTY is isolated in a small Node child host, connected to the daemon by IPC. This contains native faults and bounds terminal handle lifetime; the host exits after delivering its final output and exit code. It preserves ANSI color, interactive Quarkus prompts and resize semantics. A process has an immutable ID, editable definition, distinct run ID, and explicit stopped/starting/running/stopping/exited/failed state. Concurrent starts share one initialization promise; restart waits for stop. Environment values stay local and are never included in list responses.

The browser uses xterm.js for an individual process. A combined terminal is an observation surface: timestamped records, source labels and ANSI SGR colors, with cursor-control sequences removed. A streaming sanitizer maintains separate escape-sequence and incomplete-line state per process/run; it buffers unfinished lines until newline or an 8 KiB bound. Arbitrary terminal cursor operations from separate programs cannot meaningfully share one screen. Input always targets one selected process. Groups are persisted lists of process IDs and support batch start/stop/restart with per-member results.

## Transport and retention

REST handles control; an authenticated fetch-based SSE stream delivers sequenced events. A global monotonically increasing cursor supports replay, filtered log reads and reconnect. Subscribers are dropped on excessive backpressure. Retention is bounded by event count and byte size; a debounced atomic snapshot preserves recent output and definitions. A returned `truncated` flag exposes when a reader's cursor has fallen outside retention. This is a development observability tool, not a durable log archive: a crash can lose the most recent snapshot interval.

## Lifecycle and safety

Bind to 127.0.0.1. Validate Host and Origin, and require a per-install bearer token for all API endpoints except the same-origin browser session bootstrap. The bootstrap refuses cross-site fetches and non-browser requests. Tokens and environment overrides live in ignored local state. All launched commands have the user's OS permissions; this is deliberately not a sandbox or public hosting service.

Stop sends Ctrl-C, waits, then terminates the process tree (taskkill /T /F on Windows, process-group SIGKILL on Unix). Daemon shutdown stops owned commands. Processes do not auto-restart after a daemon crash; retained logs survive. Intentional detached children may escape OS process ownership and are outside the supervisor contract. No automatic retries, shell command guessing, dependency ordering or readiness inference: running means alive, not healthy.

## Technology choices

Node.js 22+ gives a small cross-platform runtime with a mature PTY library. Fastify and Zod keep API validation shared and explicit. React/Vite provide a small component-based interface; xterm.js supplies terminal emulation. SSE avoids unnecessary bidirectional transport: keyboard input and resize use ordered HTTP requests. MCP uses the official TypeScript SDK, forwarding to the same API instead of introducing a second process manager.

References: https://github.com/microsoft/node-pty · https://xtermjs.org/docs/ · https://fastify.dev/docs/latest/ · https://modelcontextprotocol.io/docs/develop/build-server
