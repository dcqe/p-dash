# Architecture

## Decision

Use Java 21 / Quarkus 3.33.3 as the single application and process owner. Quarkiverse MCP Server 1.13.2 embeds Streamable HTTP tools into the same CDI service graph. React/Vite is a build-time frontend; xterm.js renders terminal streams. pty4j 0.13.13 provides native PTYs, with ConPTY on Windows. Jackson handles JSON/YAML; RE2/J provides bounded-complexity regex matching for agent waits/searches.

```text
React / xterm ── REST + WebSocket ─┐
                                ├─ ProcessManager / WorkspaceService
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
  process/                   config, registry, lifecycle and workspaces
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
  process/                   command/workspace editors
  terminal/                  xterm rendering and per-source merged line assembly
  App.jsx                    workspace layout and controls
```

## Process ownership

Definitions hold an explicit argument vector, directory, env overrides, and PTY/pipe mode. ProcessManager serializes each process's start/stop/restart operations. Native terminal sessions hold the child handle; the browser and MCP tools never spawn alternate processes. Environment values stay out of list/status responses. Commands are never automatically restarted or started on boot.

PTY stop requests send Ctrl+C, wait three seconds, then terminate the process tree if needed. Pipe processes receive OS termination directly because stdin control bytes are not signals. Captured descendants are also terminated if the parent exits during the grace period. An exit watcher drains remaining output before publishing final state. Stop/edit/delete guards prevent changing an active definition. Shutdown stops managed processes concurrently and flushes output.

The shared IntelliJ Shell Script configurations provide explicit Linux (`run.sh`) and Windows (`run.ps1`) launchers. Linux remains the default documented platform. It tests/builds the frontend and clean-packages Java, then uses `exec` to replace Bash with Java. Signals therefore reach Java directly; no extra process manager or runner watcher is required on Linux. `--no-build` launches a prepared package. Existing servers must be stopped before launching; Linux never kills unrelated port owners. The optional Windows `run.ps1` requests authenticated shutdown, force-stops remaining port owners, builds, and invokes Java, whose owner-PID watcher covers runner termination. This is local development supervision, not a hardened OS service: forcibly killing Java or an OS crash can bypass graceful cleanup. Children that deliberately escape ancestry are outside this guarantee.

## Output and consistency

Reader virtual threads decode UTF-8 incrementally from each stream. A monotonic event sequence covers output, lifecycle, and workspace changes. LogService owns a bounded buffer and publishes to live subscribers. Snapshot + subscription is atomic with respect to log append, avoiding a replay/live gap. WebSocket snapshot state includes its capture cursor; the frontend applies newer state events after the snapshot. Slow consumers are disconnected when their send queue exceeds 4 MiB and reconnect with a cursor.

Persisted snapshots are atomic file replacements. Definitions and workspace settings are saved on change; logs are flushed every second and at orderly shutdown. Retention is intentionally bounded; this is a development dashboard, not a durable unlimited log archive. A single server must own a state directory.

Merged output uses independent line/escape parsers per process/run, strips cursor movement and OSC operations, and retains SGR color. Individual tabs retain native terminal behavior and target input explicitly. Resizing from the latest viewer affects the shared PTY dimensions.

Regex waits aggregate up to 64 KiB of recent text per run and strip ANSI before matching. They return matched/timedOut/exited/truncated and a cursor. RE2/J intentionally does not support backreferences or lookaround.

ProcessManager tracks readiness independently from OS aliveness. Each run has a cancellable readiness watcher, guarded by the terminal session identity so an old run cannot mark a restart ready. Log checks read only the current run's output, including output emitted before the watcher subscribes. HTTP checks poll a configured URL with bounded requests and no redirects. A readiness timeout terminates the child and records FAILED. The explicit process-only check uses successful spawn as readiness. Snapshots expose `alive` directly from the OS handle, independent of status, and include the configured check. Tab dots use `alive`; cards show lifecycle status. Latest lifecycle snapshots are saved separately from definitions and restored without reviving process handles. Missing lifecycle snapshots do not trigger reconstruction from event logs.

## Workspaces

WorkspaceService persists the workspace catalog in the workspaces section of config.json; ProcessRegistry saves definitions in its commands section. LocalState serializes section updates to preserve the other sections and atomically replaces the document. LocalState validates the complete catalog before saving at startup. Runtime lifecycle and logs remain separate from editable configuration. Each ProcessConfig carries an immutable workspaceId, defaulting to `default` when omitted at creation. The process registry, lifecycle history, and bounded event log remain owned by one server; IDs are globally unique. Creation validates the workspace and deletion permits only empty, non-default workspaces. Settings changes publish sequenced `workspaces` events, with the catalog included in WebSocket snapshots. Workspace locks protect creation/deletion races.

The browser filters commands and events by workspace and remounts the view on switching, preventing terminal/input state from crossing workspaces. View preferences live under separate browser-storage keys. A combined-source selection is a view preference, never an execution group. REST/MCP intentionally retain server-wide discovery for agents; workspaces are not authorization boundaries. There is no migration or support for older storage layouts.

Flex layout allocates remaining viewport height to the terminal; ResizeObserver fits xterm and resizes the selected PTY after card reflow. Command cards scroll when needed, and the terminal retains a minimum usable height.

## Local access

Bind loopback only. Validate Host and Origin. REST and MCP use the same bearer token. The same-origin UI bootstraps its token via `/api/session`; WebSocket connections use short-lived one-use tickets instead of putting the permanent token in a URL. API responses are not cached. Terminal/log content is data, never agent instructions. This design assumes a trusted local user account, not hostile tenants.

## Tradeoffs

MCP uses HTTP so it shares the running Java application; agents need an HTTP-capable client and the application must remain running. Native PTYs bring a native dependency but preserve Quarkus interactive shortcuts and colored output. Pipe mode is simpler when interactivity is unnecessary. Files suit a single local server; multi-user access, distributed workers, indefinite log storage and dependency orchestration would require separate designs.
