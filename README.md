# p-dash

A local dashboard for long-running commands. One Quarkus application owns processes, persists bounded logs, streams terminals to a grey React UI, and exposes the same services as MCP tools.

## Run

On this machine, run `./run.cmd` from this folder. The verified portable JDK and Maven are in ignored `.tools/`. The packaged app is ready to run.

```powershell
.\run.cmd                 # run in this console and open the browser
.\run.cmd -NoBrowser      # same application, without opening a browser
.\run.cmd -Rebuild        # rebuild the UI and Java app, including tests
```

Keep that console open. Ctrl+C stops p-dash and its managed commands. A Java owner watcher also shuts down if the runner disappears. Closing the browser does not stop processes. There is no detached Node server or second console. The PowerShell file in `scripts/` is an implementation helper; `run.cmd` is the single launcher.

The launcher rebuilds when application sources or build inputs are newer than the packaged app. `-Rebuild` forces a rebuild even when timestamps have not changed.

The default address is http://127.0.0.1:4310. `PDASH_PORT` and `PDASH_DATA` override the port and state directory. Before launch, the runner takes ownership of the configured loopback port: every existing listener and its child process tree is force-stopped, then the new Java instance is started. Keep the port dedicated to p-dash. Agents can request an authenticated `POST /api/shutdown`.

On another machine, install JDK 21+, Maven 3.9+, and Node 22+/npm for frontend builds. Set `JAVA_HOME` and put Maven/npm on PATH, then run `run.cmd -Rebuild`. Node is a build tool only. After packaging, the entire `target/quarkus-app` directory can run with:

```sh
java -jar target/quarkus-app/quarkus-run.jar
```

## Commands and terminals

Define a name, executable/arguments, working directory, optional environment overrides, and terminal mode. Every command has a stable vivid identity color; leave color unset and p-dash generates one from the command ID, or choose one in the editor. That same color appears on the command card, group markers, and merged terminal source label. The command editor takes **one argument per line**, including the executable on the first line. Arguments are passed directly; do not add surrounding quotes to paths with spaces. To run shell syntax or Windows batch files, explicitly use a shell.

For a Windows Maven module, enter:

```text
cmd.exe
/d
/s
/c
mvnw.cmd -pl orders -am quarkus:dev -Dquarkus.http.port=8081
```

Set the working directory to the repository root. Create another command for each independently running module, use distinct application/debug ports, and save them in a group. Group controls report each member's outcome; a group does not specify dependencies or readiness ordering.

PTY mode provides an interactive terminal through pty4j (ConPTY on Windows). Pipe mode preserves separate stdout and stderr streams. The combined terminal labels and merges multiple sources, preserving ANSI colors while removing unrelated cursor controls. It is read-only; select a process tab to type into that process. Existing timestamps are preserved rather than duplicated. Display pause does not pause the process.

The application chrome uses neutral grey colors; ANSI colors printed by commands remain visible. Each terminal tab has a green dot when its OS process is alive and a hollow grey dot otherwise. Command identity colors remain on cards and merged source labels.

Commands begin as `NOT_STARTED`. Starting a command moves it to `STARTING`; it becomes `RUNNING` only after its configured startup readiness check passes. Intentional termination goes through `STOPPING` to `STOPPED`. Startup failure or readiness timeout produces `FAILED`; a process that exits on its own with code 0 is `EXITED`, while a nonzero unexpected exit is `FAILED`. Lifecycle history survives dashboard restarts; interrupted runs are marked failed, never automatically reattached to old PIDs.

In the command editor, **Ready when** offers a log regex, an HTTP(S) URL returning 2xx, or an explicit **Process starts** option for commands without an application readiness signal. Auto defaults to Quarkus's `started in … Listening on:` message when the command contains `quarkus`, otherwise the word `READY`. The default startup timeout is 120 seconds and can be set up to 30 minutes. Timeout terminates the unready process. This is a startup check, not continuous health monitoring; an HTTP URL must belong to the intended command. No CPU/memory metrics are inferred from logs.

## Java demos

The first startup seeds three not-started commands and a Java demos group:

- Healthy: READY and regular heartbeat output.
- Flaky: periodic warnings and stderr errors.
- Chatty: frequent colored events.

These are standalone Java child processes managed exactly like user commands. Their definitions live in `src/main/resources/processes/`. Set `-Dpdash.demo.enabled=false` to disable seeding. Nothing starts automatically.

## Agent connection

See [Agent and AI setup](docs/agent-setup.md) for MCP, REST, and CLI configuration.

Tools cover definitions/groups, lifecycle, input/resize, incremental output, regex search, readiness, and process exit. `wait_for_ready` matches a supplied log regex; it is not an HTTP health probe. Wait calls are bounded to 30 seconds; resume from the returned cursor. See [API contract](docs/api.md).

## State and migration

Private state lives in `.pdash/` and is ignored by Git: definitions, groups, token, migration notes, and bounded output snapshots. Existing v1 user definitions are imported once with an explicit shell invocation. The old `state.json` stays untouched for rollback. Legacy demo scripts are replaced by Java demos. Migration failures are recorded in `migration-v2.json`; original definitions remain in `state.json`.

Optional `.pdash/processes/*.yaml` files seed new IDs at startup. Existing saved definitions take precedence. Logs retain up to 12,000 events / roughly 2 MiB of text and metadata, with snapshots once per second. A crash may lose the last second of output. Cursors survive normal restarts; clients must handle `truncated` when history expires or the data directory changes.

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

Windows is verified here. The pty4j backend supports Unix, but lifecycle behavior still needs a run on those platforms. Use [architecture](docs/architecture.md) for package responsibilities and tradeoffs.
