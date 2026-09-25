# Feature list

This is the inventory of implemented user-facing behavior. Keep it current whenever a feature changes (see [AGENTS.md](../AGENTS.md)).

## Workspaces

- Switch from the workspace selector in the sidebar, including on narrow screens. Each workspace has its own command definitions, lifecycle display, output view, terminal tabs, and batch controls.
- **New** creates an empty workspace. **Settings** changes its name, description, accent color, and default working directory. New commands start with that directory in their editor; existing command directories do not change.
- Workspace settings and each command's workspace assignment persist on the server. Existing definitions without an assignment belong to **Default**, preserving IDs, environment overrides, lifecycle history, and retained output.
- The chosen workspace, selected terminal tab, text filter, display pause, and combined-stream source selection persist separately per workspace in this browser. A new browser starts with default view settings. If browser storage is unavailable, views still work for the current session.
- Switching never starts or stops a process. Commands in other workspaces continue running. Start/stop/restart all acts only on the displayed workspace; errors are reported per command.
- Delete an empty workspace from Settings with confirmation. Default cannot be deleted. Remove stopped commands first. Commands cannot be reassigned to another workspace; create a new definition there instead.
- Workspaces are organizational boundaries on a trusted local server, not access-control tenants. REST/MCP status exposes all workspaces and process IDs; log retention remains bounded across the server.

## Commands and lifecycle

- **Add command** defines a name, one executable/argument per line, existing absolute directory, optional environment overrides, identity color, and PTY or pipe mode. Shell syntax requires an explicit shell.
- Colors are generated from stable command IDs when omitted, and appear on cards and combined source labels. Existing custom colors are preserved during migration.
- Each card opens its terminal and provides start, stop, restart, and edit controls. Stop before editing or deleting a definition. REST partial edits preserve omitted environment overrides; MCP full updates must supply them.
- Start, restart, and stop all controls operate on the current workspace's commands concurrently, without dependency ordering.
- Cards distinguish never started, starting, running, stopping, stopped, exited, and failed states, with PID, elapsed time, or exit information. Green terminal dots mean OS liveness, not application health.
- Startup readiness supports a log regex, an HTTP(S) 2xx response, or successful process spawn. Auto chooses Quarkus's started/listening message for Quarkus commands and READY otherwise. Startup timeout defaults to 120 seconds, is configurable from 1 second to 30 minutes, and terminates an unready process.
- Startup readiness is not continuous health monitoring. HTTP checks must target the intended application. Natural exit code 0 becomes exited; unexpected nonzero exits become failed.
- Lifecycle history survives dashboard restarts. Interrupted runs are marked failed; old PIDs are never reattached. Nothing starts automatically.

## Terminals and combined output

- A process tab shows its own terminal and sends keyboard input only to that process. PTY mode supports native interactivity and resizing; pipe mode captures stdout/stderr separately.
- **Combined stream** is read-only and merges selected commands with colored source labels and timestamps. ANSI colors are retained, unrelated cursor controls are stripped, and existing timestamps are not duplicated.
- Click source chips to include or exclude commands. **All** includes current and future commands in that workspace; **Active now** selects the currently live processes; **None** clears selection. Explicit selections remain selected after stop/restart and do not automatically follow future liveness changes. Stopped commands can be selected to review retained output.
- Filter combined lines by case-insensitive text. Pause freezes display while capture continues; Resume catches up. Source selection never affects process execution or collection.
- Download exports retained output for the current tab or selected combined sources as plain text, including source and event time. The text filter and display pause do not limit the export.
- The terminal expands into available vertical space as cards reflow. A scrollable command region leaves room for the terminal, with a minimum terminal height for small windows. Tab and content scrollbars match the dark theme; bottom padding is compact.
- Streaming reconnects with a cursor and reports expired history. Up to 12,000 events / roughly 2 MiB are retained across the server. Snapshots are written every second; a crash may lose the last second.

## Local application and agent access

- `run.cmd` launches the single Java owner, with optional browser launch, forced rebuild, and Quarkus development mode. It rebuilds stale inputs, reuses installed frontend dependencies, and takes ownership of the configured loopback port.
- Closing the browser leaves commands running. Ctrl+C, closing the runner, or authenticated shutdown stops managed commands. PTYs receive Ctrl+C before forced termination; pipe processes receive OS termination directly. Descendants are also cleaned up.
- First startup seeds Healthy, Flaky, and Chatty Java command definitions in Default; none starts automatically. Demo seeding can be disabled. YAML files can seed additional IDs; saved definitions take precedence.
- Local bearer authentication protects REST and embedded Streamable HTTP MCP. Host/Origin checks and short-lived, single-use terminal tickets protect browser access. Environment values are excluded from status responses.
- MCP and REST share the same services for workspace settings, process definitions, lifecycle, explicit terminal input/resize, incremental logs, regex search, bounded log/readiness waits, and process-exit waits. See [API contract](api.md) and [agent setup](agent-setup.md).
- Legacy user definitions are imported with explicit shell invocation. Original legacy files remain for rollback. Command groups have been removed from the UI, services, REST, MCP, and events; old group files are left untouched and ignored.
