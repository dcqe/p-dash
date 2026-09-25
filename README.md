# p-dash

A dashboard for long-running commands. One Quarkus application owns processes, persists bounded logs, streams terminals to a grey React UI, and exposes the same services as MCP tools.

## Run

On this machine, run `./run.cmd` from this folder. The verified portable JDK and Maven are in ignored `.tools/`. The packaged app is ready to run.

```powershell
.\run.cmd                 # run in this console and open the browser
.\run.cmd -NoBrowser      # same application, without opening a browser
.\run.cmd -Rebuild        # rebuild the UI and Java app, including tests
.\run.cmd -Dev            # Quarkus dev mode; Java changes reload without packaging
```

Keep that console open. Ctrl+C stops p-dash and its managed commands. A Java owner watcher also shuts down if the runner disappears. Closing the browser does not stop processes. There is no detached Node server or second console. The PowerShell file in `scripts/` is an implementation helper; `run.cmd` is the single launcher.

For faster backend iteration, `run.cmd -Dev` starts Quarkus dev mode. Java changes are hot reloaded by Quarkus. Frontend changes still require `npm run build` from `frontend/` because the dashboard is served as a packaged static resource; use the normal launcher when you need a production-like run.

The launcher rebuilds when application sources or build inputs are newer than the packaged app. `-Rebuild` forces a rebuild even when timestamps have not changed.

The default address is http://127.0.0.1:4310. `config.json` settings control the launcher port and browser launch. `PDASH_PORT` and `PDASH_DATA` override the port and state directory; `-NoBrowser` overrides browser launch. Before launch, the runner takes ownership of the configured loopback port: every existing listener and its child process tree is force-stopped, then the new Java instance is started. Keep the port dedicated to p-dash. Agents can request an authenticated `POST /api/shutdown`.

On another machine, install JDK 21+, Maven 3.9+, and Node 22+/npm for frontend builds. Set `JAVA_HOME` and put Maven/npm on PATH, then run `run.cmd -Rebuild`. Node is a build tool only. After packaging, the entire `target/quarkus-app` directory can run with:

```sh
java -jar target/quarkus-app/quarkus-run.jar
```

## Workspaces

Use the sidebar selector to switch workspaces, **New** to create one, and **Settings** to edit its name, description, accent, and default command directory. Each workspace shows its own commands and output. Switching leaves all processes running. Terminal tab, filter, pause, and combined-source selection are remembered per workspace in this browser. Existing commands remain in **Default**. Delete only empty non-default workspaces.

See the complete [feature list](docs/features.md). Agents must update that list whenever user-facing behavior changes.

## Commands and terminals

Define a name, executable/arguments, working directory, optional environment overrides, and terminal mode. Every command has a stable vivid identity color; leave color unset and p-dash generates one from the command ID, or choose one in the editor. That same color appears on the command card and merged terminal source label. The command editor takes **one argument per line**, including the executable on the first line. Arguments are passed directly; do not add surrounding quotes to paths with spaces. To run shell syntax or Windows batch files, explicitly use a shell.

For a Windows Maven module, enter:

```text
cmd.exe
/d
/s
/c
mvnw.cmd -pl orders -am quarkus:dev -Dquarkus.http.port=8081
```

Set the working directory to the repository root. Create a command for each independently running module in the appropriate workspace, using distinct application/debug ports. Batch controls act on that workspace and do not specify dependencies or readiness ordering.

PTY mode provides an interactive terminal through pty4j (ConPTY on Windows). Pipe mode preserves separate stdout and stderr streams. Use source chips under **Combined stream** to select which commands to merge, or choose **All**, **Active now**, or **None**. Explicit selections persist after processes stop; All also includes newly added commands. The combined terminal labels and merges multiple sources, preserving ANSI colors while removing unrelated cursor controls. It is read-only; select a process tab to type into that process. Existing timestamps are preserved rather than duplicated. Display pause does not pause the process.

The application chrome uses neutral grey colors; ANSI colors printed by commands remain visible. Each terminal tab has a green dot when its OS process is alive and a hollow grey dot otherwise. Command identity colors remain on cards and merged source labels.

Commands begin as `NOT_STARTED`. Starting a command moves it to `STARTING`; it becomes `RUNNING` only after its configured startup readiness check passes. Intentional termination goes through `STOPPING` to `STOPPED`. Startup failure or readiness timeout produces `FAILED`; a process that exits on its own with code 0 is `EXITED`, while a nonzero unexpected exit is `FAILED`. Lifecycle history survives dashboard restarts; interrupted runs are marked failed, never automatically reattached to old PIDs.

In the command editor, **Ready when** offers a log regex, an HTTP(S) URL returning 2xx, or an explicit **Process starts** option for commands without an application readiness signal. Auto defaults to Quarkus's `started in … Listening on:` message when the command contains `quarkus`, otherwise the word `READY`. The default startup timeout is 120 seconds and can be set up to 30 minutes. Timeout terminates the unready process. This is a startup check, not continuous health monitoring; an HTTP URL must belong to the intended command. No CPU/memory metrics are inferred from logs.

## Java demos

The first startup seeds three not-started commands in the Default workspace:

- Healthy: READY and regular heartbeat output.
- Flaky: periodic warnings and stderr errors.
- Chatty: frequent colored events.

These are standalone Java child processes managed exactly like user commands. Their definitions live in `src/main/resources/processes/`. Set `-Dpdash.demo.enabled=false` to disable seeding. Nothing starts automatically.

## Agent connection

See [Agent and AI setup](docs/agent-setup.md) for MCP, REST, and CLI configuration.

Tools cover definitions/workspaces, lifecycle, input/resize, incremental output, regex search, readiness, and process exit. `wait_for_ready` matches a supplied log regex; it is not an HTTP health probe. Wait calls are bounded to 30 seconds; resume from the returned cursor. See [API contract](docs/api.md).

## State

Private state lives in `.pdash/` and is ignored by Git. Edit `.pdash/config.json` while p-dash is stopped to configure workspaces, commands, and launcher settings in one place. UI/API edits save to this same file. See [Configuration and storage](docs/configuration.md) for the format and migration details. Credentials live in `auth/`, output in `logs/`, and lifecycle state in `runtime/`. Old flat files are migrated automatically on startup, with old definitions preserved in `backups/`. Optional `.pdash/imports/processes/*.yaml` files seed new IDs; saved definitions take precedence. Logs retain up to 12,000 events / roughly 2 MiB of text and metadata, with snapshots once per second. A crash may lose the last second of output. Cursors survive normal restarts; clients must handle `truncated` when history expires or the data directory changes.

## Development and checks

```sh
cd frontend
npm ci
npm test
npm run build
cd ..
mvn test
mvn package
```

Build the frontend before Maven packaging; Maven copies `frontend/dist` into the Quarkus application. For UI development, run Quarkus on 4310 and `npm run dev` in `frontend/` (Vite proxies API and WebSocket requests). Tests use an isolated state directory and random HTTP port; they launch real child JVMs and PTYs.

Pipe processes receive OS termination directly instead of a Ctrl+C byte on stdin, avoiding the unnecessary three-second stop delay. PTYs retain Ctrl+C and the grace period.

Windows is verified here. The pty4j backend supports Unix, but lifecycle behavior still needs a run on those platforms. Use [architecture](docs/architecture.md) for package responsibilities and tradeoffs.
