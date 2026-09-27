# p-dash

A local dashboard for long-running commands, with workspaces, interactive terminals, combined logs, readiness checks, and an embedded MCP server. One Java/Quarkus application owns all processes.

## Run

Linux is the default platform (glibc, x86-64).

**Prerequisites:** JDK 21+, Maven 3.9+, Node.js 22.12+/npm, Bash, jq.

```sh
./run.sh
```

Open http://127.0.0.1:4310. Each launch tests and builds the app. Add `--no-browser` to suppress browser launch. In IntelliJ, select **p-dash — Linux** or **p-dash — Windows** (Shell scripts plugin).

Stop an existing instance before launching. Ctrl+C stops the app and managed commands; closing the browser does not. Commands never start automatically.

**Prebuilt archive:** Java 21+, Bash and jq only. After extraction:

```sh
./run.sh --no-build --no-browser
```

**Windows:** JDK 21+, Maven 3.9+, Node.js 22.12+/npm, Windows PowerShell.

Launchers use installed tools on `PATH` (`JAVA_HOME` for the Windows JDK) and Maven's standard cache; no project-local `.tools` setup is needed.

```powershell
.\run.ps1
```

The Windows launcher replaces existing listeners on the configured port; keep it dedicated to p-dash.

## Use

Create a workspace, add commands, and start them from the dashboard. Enter the executable and each argument on separate lines. Use a process tab for interactive input or **Combined stream** to view multiple commands.

Settings and definitions live in `.pdash/config.json`; edit it only while stopped. `PDASH_DATA` selects another state directory and `PDASH_PORT` overrides port 4310. Keep state private and preserve it across upgrades.

## Development

```sh
cd frontend
npm ci
npm test
npm run build
cd ..
mvn test
mvn package
```

For hot reload, run `mvn quarkus:dev` and `npm run dev` in `frontend/` separately.

## Documentation

- [Features](docs/features.md)
- [Configuration and storage](docs/configuration.md)
- [Agent setup](docs/agent-setup.md) and [API contract](docs/api.md)
- [Architecture](docs/architecture.md)
- [Publishing](docs/publishing.md)
