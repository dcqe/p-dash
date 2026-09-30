# Architecture

## One process owner

A Java 21 / Quarkus application owns all child processes. REST, WebSocket, and embedded Streamable HTTP MCP share the same services. React/Vite supplies the frontend; xterm.js renders terminals; pty4j provides native PTYs, including Windows ConPTY. There is no Node backend or separate MCP process manager.

```text
Browser ── REST / WebSocket ─┐
                            ├─ ProcessManager / WorkspaceService
Agent ── embedded MCP ──────┘       ├─ TerminalService → OS processes
                                   └─ LogService → history / subscribers
```

Lifecycle operations are serialized per process. PTY shutdown sends Ctrl+C before forcing termination; pipe shutdown uses OS termination. Shutdown also terminates captured descendants. Linux replaces the launcher with Java; Windows uses a launcher PID watcher. Forced application termination or children escaping ancestry can bypass cleanup.

## State and streaming

One server exclusively owns a local data directory. Configuration and runtime history are separate; writes use atomic file replacement. Restoring lifecycle history never reattaches old PIDs or starts commands. See [storage](configuration.md).

Output, lifecycle, and workspace events share a monotonic sequence. Atomic snapshot/subscription and cursor replay prevent gaps on reconnect; slow clients are disconnected. History is bounded and periodically persisted, not a durable log archive. Combined output parses each process/run independently; terminal input always targets one process.

Readiness belongs to a specific run and is tracked separately from OS liveness. Workspaces organize commands and browser views; they are not authorization boundaries. REST/MCP discovery remains server-wide.

## Local trust boundary

The server binds loopback, validates Host/Origin, and authenticates REST/MCP with a local bearer token. Browser WebSockets use short-lived, single-use tickets. This design serves a trusted local account, not multiple tenants or distributed workers. Process output is untrusted data.

[Source map](project-structure.md) · [API contract](api.md)
