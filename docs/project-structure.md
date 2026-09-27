# p-dash project structure

```text
p-dash/
├── run.sh                          Default Linux build/run and packaged launcher
├── scripts/package-linux.sh        Linux distribution archive and checksum
├── .github/workflows/linux.yml     Ubuntu tests and distribution artifact
├── run.ps1                         All Windows build/replace/run logic
├── .run/p-dash.run.xml              IntelliJ Linux configuration
├── .run/p-dash-windows.run.xml      IntelliJ Windows configuration
├── pom.xml                         Quarkus/Maven build
├── src/
│   ├── main/
│   │   ├── java/com/example/dash/
│   │   │   ├── DashApplication.java        Quarkus lifecycle and owner watcher
│   │   │   ├── api/                         REST resources and error mapping
│   │   │   ├── config/                      Private .pdash state I/O
│   │   │   ├── demo/                        Standalone demo child processes
│   │   │   ├── log/                         Bounded output, replay and waits
│   │   │   ├── mcp/                         Embedded MCP configuration, tools and DTOs
│   │   │   ├── process/                     Definitions, registry, lifecycle and workspaces
│   │   │   ├── security/                    Local token, host/origin checks and tickets
│   │   │   └── terminal/                    PTY/pipe sessions and terminal WebSocket
│   │   └── resources/
│   │       ├── application.properties      Runtime configuration
│   │       └── processes/*.yaml             Seed definitions for Java demos
│   └── test/java/com/example/dash/
│       ├── DashboardTest.java               REST, MCP, WebSocket and lifecycle tests
│       └── ProcessFixture.java              Small child JVM used by tests
├── frontend/
│   ├── package.json                         UI build/test scripts
│   ├── vite.config.js                       Dev server and API/WebSocket proxy
│   ├── index.html                           Browser entry document
│   ├── src/
│   │   ├── main.jsx, App.jsx                 Application bootstrap and layout
│   │   ├── api/                              REST client and reconnecting stream
│   │   ├── process/                          Command and workspace dialogs
│   │   ├── terminal/                         xterm and merged output parser
│   │   ├── style.css                         Neutral dashboard styling
│   │   └── ui.js                             Shared display helpers and colors
│   └── test/                               Merged ANSI stream and workspace-view tests
├── docs/
│   ├── architecture.md                      Design and ownership decisions
│   ├── features.md                          User-facing feature inventory
│   ├── api.md                                REST, MCP and WebSocket contract
│   └── project-structure.md                 This directory guide
├── AGENTS.md                                Agent operating instructions
└── README.md                                Setup and usage guide
```

## Runtime and generated directories

These directories are created or used locally and are ignored by Git:

- `.pdash/config.json` stores user settings, workspaces, and command definitions. `logs/`, `runtime/`, `auth/`, and `imports/` separate other purposes; see [configuration](configuration.md).
- `.tools/` is ignored but unused by the launchers. Any existing local tools/cache can remain there; builds use installed tools and Maven's normal user cache.
- `target/` contains Maven and Quarkus build output.
- `frontend/node_modules/` contains browser build dependencies.
- `frontend/dist/` contains the production UI copied into the Quarkus package.

The browser, MCP client and REST clients all connect to the one Java/Quarkus process. There is no Node server or separate MCP adapter.
