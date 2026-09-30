# Configuration and storage

Settings, workspaces, and command definitions live in `.pdash/config.json`. UI/API edits save there. Stop p-dash before editing it manually, then restart. Keep the data directory private: command environment values and credentials may contain secrets.

`PDASH_DATA` selects another data directory. Use an absolute path outside the installation to retain state when replacing a packaged build.

## Configuration

Example with an existing absolute project directory:

```json
{
  "version": 1,
  "settings": {"port": 4310, "openBrowser": true, "demoEnabled": false},
  "workspaces": [],
  "commands": [{
    "id": "app",
    "workspaceId": "default",
    "name": "App",
    "command": ["mvn", "quarkus:dev"],
    "workingDirectory": "/home/me/project",
    "env": {},
    "mode": "pty",
    "readiness": {"mode": "auto"}
  }]
}
```

IDs must be unique and workspace references valid; Default is supplied automatically. See [API](api.md) for definition fields.

The launchers read `port` and `openBrowser`. `PDASH_PORT` overrides the port; `--no-browser` (Linux) or `-NoBrowser` (Windows) disables browser launch. Direct Java launches use Quarkus properties/environment for these options. All three settings fields are required if `settings` is supplied; otherwise defaults are 4310, true, true.

`demoEnabled` controls demo seeding. Optional YAML seeds add missing IDs without replacing saved definitions. Disable seeding or remove the relevant seed to prevent a deleted demo from returning.

## Stored state

| Path within the data directory | Contents |
| --- | --- |
| `config.json` | Settings, workspaces, commands |
| `auth/token` | REST/MCP bearer credential |
| `logs/output.json` | Bounded output and event history |
| `runtime/lifecycle.json` | Latest process lifecycle state |
| `imports/processes/` | Optional YAML seeds |
| `owner.lock` | Exclusive server ownership |

Only the current storage format is supported; incompatible state is rejected without conversion. Preserve user files when resolving errors. History retains up to 12,000 events / roughly 2 MiB across the server and flushes every second, so crashes may lose recent output. Interrupted runs are marked failed on restart.
