# Configuration and storage

Stop p-dash before editing `.pdash/config.json`, then restart it. The dashboard and REST/MCP save workspace and command edits to this same file. It is formatted JSON, without comments. Editing it while the server runs is unsupported: the next UI/API save can overwrite external changes.

The file is created on first startup. A minimal example (replace the example directories with existing absolute paths):

```json
{
  "version": 1,
  "settings": {
    "port": 4310,
    "openBrowser": true,
    "demoEnabled": false
  },
  "workspaces": [
    {
      "id": "orders",
      "name": "Orders",
      "description": "Local services",
      "color": "#5B8FF9",
      "workingDirectory": "C:\\projects\\orders"
    }
  ],
  "commands": [
    {
      "id": "orders-api",
      "workspaceId": "orders",
      "name": "API",
      "command": ["cmd.exe", "/d", "/s", "/c", "mvnw.cmd quarkus:dev"],
      "workingDirectory": "C:\\projects\\orders",
      "env": {},
      "mode": "pty",
      "readiness": {
        "mode": "log",
        "value": "started in.*Listening on:",
        "timeoutMs": 120000
      }
    }
  ]
}
```

Workspace and command IDs must be unique within their catalogs and stable. Each command references a workspace; omission uses `default`, which the application supplies if absent. Workspace directories prefill the UI command editor; each saved command still needs its own absolute directory. Workspace settings do not change existing commands. The API contract documents the remaining [command and workspace fields](api.md). Commands never start automatically. Dependencies and start ordering are not supported.

`settings.port` (1–65535) and `settings.openBrowser` are read by `run.ps1`. `PDASH_PORT` overrides the port and `-NoBrowser` disables browser launch. Direct `java -jar` launches use Quarkus properties/environment for port and browser launch instead. `settings.demoEnabled` controls Java demo seeding for script and direct-Java launches; `-Dpdash.demo.enabled=false` can also disable it. Disabling seeding does not remove saved demos. All three settings are required when supplying a settings object; omitting the entire object supplies defaults of 4310, true, and true.

`PDASH_DATA` selects the data directory before config is read; it cannot be set inside that directory's config. Owner PID, authentication credentials, lifecycle history, logs, and browser view preferences are not user configuration. Environment overrides in commands may contain secrets: keep the entire data directory private and out of Git.

```text
.pdash/
  config.json             Settings, workspaces, commands
  owner.lock              Single-server ownership lock
  auth/token              Local bearer credential
  logs/output.json        Bounded process output and sequenced events
  runtime/lifecycle.json  Latest lifecycle snapshots
  imports/processes/      Optional YAML seed definitions
```

Startup reads only `config.json`, `auth/token`, `runtime/lifecycle.json`, and `logs/output.json`. A clean data directory receives a fresh current configuration. Older flat state without a current config is rejected without modifying its files. Unsupported config versions and invalid definitions fail startup without overwriting the config. There is no migration, archival, or lifecycle reconstruction from logs. Missing lifecycle state means commands start with no previous run history; interrupted current runs are still marked failed on restart.

Optional YAML seeds add missing IDs only; they do not override saved commands. To permanently remove a seeded command, also disable demo seeding or remove its YAML seed. Logs keep the existing bounded retention, cursor and flush behavior. The launcher writes server diagnostics to its console.

Credentials are read only from `auth/token`. Older application versions and storage layouts are not supported.
