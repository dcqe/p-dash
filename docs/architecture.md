# Architecture

## Decision

Use Java 21 / Quarkus 3.33.3 as the single application and process owner. Quarkiverse MCP Server 1.13.2 embeds Streamable HTTP tools into the same CDI service graph. React/Vite is a build-time frontend; xterm.js renders terminal streams. pty4j 0.13.13 provides native PTYs, with ConPTY on Windows. Jackson handles JSON/YAML; RE2/J provides bounded-complexity regex matching for agent waits/searches.

```text
React / xterm ── REST + WebSocket ─┐
                                ├─ ProcessManager / GroupService
AI agent ── embedded MCP tools ──┘         │
                                         ├─ TerminalService → real OS child processes
                                         └─ LogService → buffer + snapshots + subscribers
```

There is no Node backend, CLI process owner, MCP stdio adapter, or HTTP hop between MCP tools and application services.

## Source layout

```text
src/main/java/com/example/dash/
  DashApplication.java       lifecycle, browser launch, runner ownership
  config/                    private local state I/O
  process/                   config, registry, lifecycle, groups, migration
  log/                       bounded history, replay, subscriptions, regex waits
  terminal/                  native terminal sessions and authenticated WebSocket
  security/                  local bearer tokens and one-use connection tickets
  api/                       REST resources, validation/error responses
  mcp/tool/                  thin service-calling tools
  mcp/dto/                   structured tool requests/results
  demo/processes/            independent Healthy, Flaky and Chatty Java programs
src/main/resources/processes/  seed YAML definitions
src/test/java/                 actual lifecycle and transport integration tests
frontend/src/
  api/                       HTTP client and reconnecting stream hook
  process/                   command/group editors
  terminal/                  xterm rendering and per-source merged line assembly
  agent/                     connection instructions
  App.jsx                    workspace layout and controls
```

## Process ownership

Definitions hold an explicit argument vector, directory, env overrides, and PTY/pipe mode. ProcessManager serializes each process's start/stop/restart operations. Native terminal sessions hold the child handle; the browser and MCP tools never spawn alternate processes. Environment values stay out of list/status responses. Commands are never automatically restarted or started on boot.

Stop requests send Ctrl+C, wait three seconds, then terminate the process tree if needed. Captured descendants are also terminated if the parent exits during the grace period. An exit watcher drains remaining output before publishing final state. Stop/edit/delete guards prevent changing an active definition. Shutdown stops managed processes concurrently and flushes output.

`run.cmd` invokes its PowerShell helper, which directly invokes Java in the same console. Java watches the helper PID to cover abrupt runner termination. This is local development supervision, not a hardened OS service: killing Java forcibly or an OS crash can bypass graceful cleanup. Windows detached children that deliberately escape ancestry are outside this guarantee.

## Output and consistency

Reader virtual threads decode UTF-8 incrementally from each stream. A monotonic event sequence covers output, lifecycle, and group changes. LogService owns a bounded buffer and publishes to live subscribers. Snapshot + subscription is atomic with respect to log append, avoiding a replay/live gap. WebSocket snapshot state includes its capture cursor; the frontend applies newer state events after the snapshot. Slow consumers are disconnected when their send queue exceeds 4 MiB and reconnect with a cursor.

Persisted snapshots are atomic file replacements. Definitions and groups are saved on change; logs are flushed every second and at orderly shutdown. Retention is intentionally bounded; this is a development dashboard, not a durable unlimited log archive. A single server must own a state directory.

Merged output uses independent line/escape parsers per process/run, strips cursor movement and OSC operations, and retains SGR color. Individual tabs retain native terminal behavior and target input explicitly. Resizing from the latest viewer affects the shared PTY dimensions.

Regex waits aggregate up to 64 KiB of recent text per run and strip ANSI before matching. They return matched/timedOut/exited/truncated and a cursor. Readiness has an explicit log pattern; it is never inferred from a RUNNING state. RE2/J intentionally does not support backreferences or lookaround.

## Local access

Bind loopback only. Validate Host and Origin. REST and MCP use the same bearer token. The same-origin UI bootstraps its token via `/api/session`; WebSocket connections use short-lived one-use tickets instead of putting the permanent token in a URL. API responses are not cached. Terminal/log content is data, never agent instructions. This design assumes a trusted local user account, not hostile tenants.

## Tradeoffs

MCP uses HTTP so it shares the running Java application; agents need an HTTP-capable client and the application must remain running. Native PTYs bring a native dependency but preserve Quarkus interactive shortcuts and colored output. Pipe mode is simpler when interactivity is unnecessary. Files suit a single local workspace; multi-user access, distributed workers, indefinite log storage and dependency orchestration would require separate designs.
