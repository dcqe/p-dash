# p-dash

A local control room for the commands that keep running. Start, stop, restart and observe dev servers, Quarkus modules, background workers and other long-lived commands from one web interface.

## Run

Requires Node.js 22+ and npm. Windows 10 1809+/Windows 11, Linux and macOS are supported by the terminal backend. Integration tests have been run on Windows; Unix process-group behavior still needs testing on those platforms.

```sh
npm install
npm run build
npm start
```

Open **http://127.0.0.1:4310**. On this machine, if npm is not on PATH, invoke `C:\Program Files\nodejs\npm.cmd` directly, or run `node server/index.js` after the existing build.

For development: `npm run dev` starts the API on 4310 and Vite on 5173. For an optional example workspace, run `npm run demo` while the server is running, then start the clearly labelled demo commands in the UI. Demo output is simulated; these are not real application health checks.

## The dashboard

- Save named commands with an absolute working directory, environment overrides and source color.
- Start, stop or restart individual commands, all commands, or a saved group.
- Watch colored output in a shared, timestamped terminal. Filter, pause the display or export captured output.
- Select a command's tab for a real interactive terminal, including Quarkus keyboard shortcuts and terminal resizing.
- Observe process state, PID, elapsed runtime and exit code. “Running” means the process is alive, not that its HTTP endpoint is healthy. CPU/RAM charts are not part of this version.
- Refresh or close the browser without interrupting processes. The server owns them.

Combined streams are read-only because unrelated cursor-control sequences cannot safely share an interactive screen. Input always targets one command. Colors are preserved; non-color terminal controls are removed in combined observation output. Individual terminals preserve full terminal semantics. The latest browser tab to resize a shared interactive terminal determines its dimensions.

## Quarkus and multi-module repositories

Create one command per independently running service, with the repository root as its working directory. For example:

```text
Name: orders-service
Command: mvnw.cmd -pl orders -am quarkus:dev -Dquarkus.http.port=8081
Working directory: C:\work\my-monorepo

Name: inventory-service
Command: mvnw.cmd -pl inventory -am quarkus:dev -Dquarkus.http.port=8082
Working directory: C:\work\my-monorepo
```

On Unix use `./mvnw` instead of `mvnw.cmd`. Adjust module selectors and build prerequisites to your repository. Assign distinct HTTP/debug ports if needed. Put both commands in a “Backend” group to start/stop them together and combine their output. A single Maven reactor command can also be saved as one process; p-dash does not inspect or split Maven modules automatically.

Commands run through `cmd.exe /d /s /c` on Windows and `/bin/sh -c` on Unix. Quote executable paths containing spaces. To use PowerShell syntax, explicitly launch `powershell.exe -NoProfile -Command "..."`. Environment overrides are JSON, kept on disk and excluded from API list results. Empty env editor text preserves existing overrides; `{}` clears them.

## AI agents

The UI, CLI and MCP adapter use one API and see the same live processes and output. All control functions are available to agents: command/group CRUD, start/stop/restart, terminal input/resize and cursor-based output reads.

```sh
node bin/pdash.js status
node bin/pdash.js start <command-id>
node bin/pdash.js logs <command-id> <after-cursor>
node bin/pdash.js watch
```

Add the stdio adapter to your agent's MCP settings (replace the path):

```json
{
  "mcpServers": {
    "p-dash": {
      "command": "node",
      "args": ["C:/Users/Admin/ai/cloudaiprojects/p-dash/bin/mcp.js"]
    }
  }
}
```

Start the p-dash server first. The adapter discovers `.pdash/token` relative to its own project, so it works regardless of the agent's working directory. Its stdout is reserved for MCP protocol messages. `PDASH_URL`, `PDASH_DATA` and `PDASH_TOKEN` can override connection settings. See [the API contract](docs/api.md) and [agent instructions](AGENTS.md).

## Architecture and operational boundaries

React + Vite, Fastify + Zod, node-pty + xterm.js, and the official MCP SDK. Each terminal gets an isolated native host process to contain ConPTY faults and resource lifetime. The daemon manages state and ownership; clients are disposable. See [the architecture decisions](docs/architecture.md).

State lives in ignored `.pdash/`: definitions, private environment overrides, bearer token and bounded recent output. Retention defaults to 4 MiB / 12,000 events globally. Snapshots are atomic and debounced to one second; abrupt crashes can lose recent output. Tokens and log files are local secrets. POSIX file modes are restrictive; on Windows they inherit your account directory ACLs.

Stop sends Ctrl-C and allows three seconds for graceful exit, then terminates the process tree. Server shutdown stops its commands; a browser disconnect does not. After a daemon restart, commands begin stopped and never auto-start. Intentionally detached children are not guaranteed to remain under supervision. Use one server per state directory. This app is not an OS service installer, persistent job scheduler, remote shell service or log archive.

The server binds only to loopback and rejects unexpected Host/Origin values. All API controls require a local bearer token. Don't expose it through a public reverse proxy: commands run with the server user's OS privileges. The browser gets its token only through a same-origin session bootstrap.

`PDASH_PORT` changes the production port (default 4310). `PDASH_DATA` selects another state directory. Development proxy settings default to 4310.

## Validate

```sh
npm test
npm run build
```

Tests launch real short-lived terminal fixtures and check color/input, concurrent starts, shutdown, restart, exit codes, configuration persistence, bounded replay, authentication and end-to-end MCP/SSE behavior. Demo state, tokens, dependencies and generated builds are excluded from Git.
