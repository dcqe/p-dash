# Source map

Java sources are under `src/main/java/com/example/dash/`:

| Area | Responsibility |
| --- | --- |
| `process/`, `terminal/` | Definitions, workspaces, lifecycle, PTY/pipe sessions |
| `log/` | Bounded history, replay, search, waits |
| `api/`, `mcp/`, `security/` | Transports and local authentication |
| `config/` | Local state persistence |
| `DashApplication.java`, `demo/` | Application lifecycle and demo processes |

The React UI is in `frontend/src/`; tests are in `src/test/java/` and `frontend/test/`. Maven packages `frontend/dist/` into `target/quarkus-app/`.

`run.sh` and `run.ps1` launch the app; `.run/` contains IntelliJ configurations. `scripts/package-linux.sh` and `.github/workflows/linux.yml` build the Linux distribution.

See [architecture](architecture.md) for design and [configuration](configuration.md) for runtime storage.
