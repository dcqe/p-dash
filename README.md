# p-dash

A local dashboard for long-running commands, log viewing, workspaces, and AI agent access through MCP.

## Run

Install JDK 21+, Maven 3.9+, and Node.js 22.12+/npm. Linux also requires Bash and jq; Windows requires Windows PowerShell. Tools must be on PATH; Windows can use JAVA_HOME for the JDK.

```sh
./run.sh              # Linux (glibc, x86-64)
```

```powershell
.\run.ps1            # Windows
```

Both launchers test and build before starting. In IntelliJ, use **p-dash — Linux** or **p-dash — Windows** with the Shell scripts plugin. Open http://127.0.0.1:4310. Suppress browser launch with `--no-browser` on Linux or `-NoBrowser` on Windows.

Stop an existing Linux instance first. The Windows launcher stops existing listeners on the configured port, so keep that port dedicated to p-dash. Ctrl+C stops the app and managed commands; closing the browser leaves them running.

## Use

Create a workspace, add commands, and start them explicitly. Enter the executable and each argument on separate lines—for example:

```text
mvn
quarkus:dev
```

Set the working directory to the project's absolute path. Open a process tab for its logs or **Combined stream** for merged output. Both are read-only; select text and press Ctrl+C to copy. Commands never start automatically.

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

For hot reload, run `mvn quarkus:dev` and, in another terminal, `npm run dev` from `frontend/`.

## Documentation

- [Major features](docs/features.md)
- [Configuration and storage](docs/configuration.md)
- [Agent setup](docs/agent-setup.md) · [API](docs/api.md)
- [Architecture](docs/architecture.md) · [Source map](docs/project-structure.md)
- [Linux builds and distribution](docs/publishing.md)
