# Feature list

This is the inventory of implemented user-facing behavior. Keep it current whenever a feature changes (see [AGENTS.md](../AGENTS.md)).

## Workspaces

- The expanded sidebar header aligns the p-dash logo with the collapse toggle. The logo is decorative text and an icon; clicking it does not navigate or reload the app.
- The sidebar always stays on the left. Its toggle switches between full navigation and a compact rail with workspace selection and action icons. It starts expanded at widths of 1280px or more, collapsed below that; crossing that breakpoint restores the automatic layout. Manual toggles last until crossing the breakpoint or reloading, and survive workspace switches. This preference is not saved.
- Switch from the workspace selector in the sidebar, including on narrow screens. Each workspace has its own command definitions, lifecycle display, output view, terminal tabs, and batch controls.
- The workspace dropdown shows accent-colored initials, names, descriptions, and a checkmark for the current workspace. The collapsed rail uses the same dropdown. Arrow keys and Home/End navigate options; Enter selects, Escape or an outside click closes. Opening the menu changes no saved settings; selection switches the current view only.
- **New** creates an empty workspace. **Settings** changes its name, description, accent color, and default working directory. New commands start with that directory in their editor; existing command directories do not change.
- Workspace settings and each command's workspace assignment persist on the server. New commands without an explicit workspace use **Default**.
- On each application launch, the first workspace listed by the server configuration opens. The selected terminal tab, text filter, display pause, and combined-stream source selection persist separately per workspace in this browser. If browser storage is unavailable, views still work for the current session.
- Switching never starts or stops a process. Commands in other workspaces continue running. Start/stop/restart all acts only on the displayed workspace; errors are reported per command.
- Delete an empty workspace from Settings with confirmation. Default cannot be deleted. Remove stopped commands first. Commands cannot be reassigned to another workspace; create a new definition there instead.
- Workspaces are organizational boundaries on a trusted local server, not access-control tenants. REST/MCP status exposes all workspaces and process IDs; log retention remains bounded across the server.

## Commands and lifecycle

- The main area starts with **Commands** and its controls. Workspace selection stays in the sidebar; there is no breadcrumb or host-address bar above Commands.
- **Add command** defines a name, one executable/argument per line, existing absolute directory, optional environment overrides, identity color, and PTY or pipe mode. Shell syntax requires an explicit shell.
- Colors are generated from stable command IDs when omitted, and appear on cards and combined source labels.
- Each card opens its terminal and provides start, stop, restart, and edit controls. Stop before editing or deleting a definition. REST partial edits preserve omitted environment overrides; MCP full updates must supply them.
- Start, restart, and stop all controls operate on the current workspace's commands concurrently, without dependency ordering.
- Cards distinguish never started, starting, running, stopping, stopped, exited, and failed states, with PID, elapsed time, or exit information. Green terminal dots mean OS liveness, not application health.
- Startup readiness supports a log regex, an HTTP(S) 2xx response, or successful process spawn. Auto chooses Quarkus's started/listening message for Quarkus commands and READY otherwise. Startup timeout defaults to 120 seconds, is configurable from 1 second to 30 minutes, and terminates an unready process.
- Startup readiness is not continuous health monitoring. HTTP checks must target the intended application. Natural exit code 0 becomes exited; unexpected nonzero exits become failed.
- Lifecycle history survives dashboard restarts. Interrupted runs are marked failed; old PIDs are never reattached. Nothing starts automatically.

## Terminals and combined output

- Open merged output through the **Combined stream** terminal tab; there is no duplicate All commands shortcut in the sidebar.
- A process tab shows its own terminal and sends keyboard input only to that process. PTY mode supports native interactivity and resizing; pipe mode captures stdout/stderr separately.
- **Combined stream** is read-only and merges selected commands with colored source labels and timestamps. ANSI colors are retained, unrelated cursor controls are stripped, and existing timestamps are not duplicated.
- Click source chips to include or exclude commands. **All** includes current and future commands in that workspace; **Active now** selects the currently live processes; **None** clears selection. Explicit selections remain selected after stop/restart and do not automatically follow future liveness changes. Stopped commands can be selected to review retained output.
- Filter combined lines by case-insensitive text. Pause freezes display while capture continues; Resume catches up. Source selection never affects process execution or collection.
- The terminal status footer is omitted to keep the output area focused. The **All** source chip is highlighted whenever every command in the workspace is selected, including explicit selections made one command at a time.
- Download exports retained output for the current tab or selected combined sources as plain text, including source and event time. The text filter and display pause do not limit the export.
- The terminal expands into available vertical space as cards reflow. A scrollable command region leaves room for the terminal, with a minimum terminal height for small windows. Tab and content scrollbars match the dark theme; bottom padding is compact.
- Streaming reconnects with a cursor and reports expired history. Up to 12,000 events / roughly 2 MiB are retained across the server. Snapshots are written every second; a crash may lose the last second.

## Local application and agent access

- Linux is the default platform for setup, command-editor examples, and the shared IntelliJ **p-dash — Linux** configuration. `bash run.sh` restores locked frontend dependencies, tests/builds the UI, and clean-packages/tests Java before replacing the launcher with Java. Build failures never launch stale artifacts. Stop existing servers first; the Linux launcher does not terminate port listeners. `--no-browser` suppresses browser launch, as do headless sessions. `--no-build` runs a prepared package with only Java, Bash and jq installed. Settings and definitions remain in the selected data directory; nothing starts automatically.
- `bash scripts/package-linux.sh` packages an already-built app using an explicit file allowlist, with a SHA-256 checksum. Linux CI tests real PTYs and uploads the archive. The archive includes the full Java runtime package, launcher and documentation, with no local state or tool caches. See [publishing](publishing.md) for prerequisites and limitations.
- IntelliJ provides separate **p-dash — Linux** and **p-dash — Windows** configurations through the Shell scripts plugin. Select the one matching your OS; the selection is local to your IDE. Windows invokes `run.ps1` with Windows PowerShell and a process-scoped execution-policy bypass, with output in the Run window. Its interpreter path assumes Windows is installed at `C:/Windows`.
- Windows remains available through `run.ps1` and `-NoBrowser`; that launcher requests orderly shutdown and force-stops remaining configured-port listeners. Keep its port dedicated to p-dash.
- Launchers use installed Java, Maven and npm; Windows resolves Java from `JAVA_HOME` or `PATH` and checks for a JDK, Maven and npm before stopping an existing server. No launcher discovers tools under `.tools` or overrides Maven's repository location. Maven uses its normal user cache (or the user's Maven configuration); existing `.tools` files are left untouched.
- Closing the browser leaves commands running. Ctrl+C, closing the runner, or authenticated shutdown stops managed commands. PTYs receive Ctrl+C before forced termination; pipe processes receive OS termination directly. Captured descendants are also terminated, and Stop waits up to five seconds for their exit after forced termination; a timeout is reported as an error.
- First startup seeds Healthy, Flaky, and Chatty Java command definitions in Default; none starts automatically. Demo seeding can be disabled. YAML files can seed additional IDs; saved definitions take precedence.
- Local bearer authentication protects REST and embedded Streamable HTTP MCP. Host/Origin checks and short-lived, single-use terminal tickets protect browser access. Environment values are excluded from status responses.
- MCP and REST share the same services for workspace settings, process definitions, lifecycle, explicit terminal input/resize, incremental logs, regex search, bounded log/readiness waits, and process-exit waits. See [API contract](api.md) and [agent setup](agent-setup.md).
- Command groups are not supported.

## Configuration and storage

- Edit .pdash/config.json while the app is stopped: it contains version, settings, workspaces, and commands. UI and API changes save to that same file. Restart to apply file edits; there is no live file reload.
- Launcher settings control port and browser launch; demoEnabled controls seeding. Environment/CLI overrides remain available. See [configuration](configuration.md) for the full format and direct-Java limitations.
- Output lives in `logs/`, credentials in `auth/`, lifecycle state in `runtime/`, and optional YAML seeds in `imports/processes/`. The root `owner.lock` prevents two servers from owning the same data directory.
- Startup uses only the current configuration and storage layout. Fresh directories get a current config; incompatible flat state without a current config is rejected unchanged. No migration, backup creation, old-token fallback, or lifecycle reconstruction from logs is performed. Invalid config, duplicate IDs, and missing workspace references prevent startup without replacing the config.
- The launcher serves a freshly built frontend; it has no dev-mode switch. Use `mvn quarkus:dev` and `npm run dev` in frontend/ separately for hot reload.
