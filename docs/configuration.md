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

`settings.port` (1–65535) and `settings.openBrowser` are read by `run.cmd`, including `-Dev`. `PDASH_PORT` overrides the port and `-NoBrowser` disables browser launch. Direct `java -jar` launches use Quarkus properties/environment for port and browser launch instead. `settings.demoEnabled` controls Java demo seeding in both launch modes; `-Dpdash.demo.enabled=false` can also disable it. Disabling seeding does not remove saved demos. All three settings are required when supplying a settings object; omitting the entire object supplies defaults of 4310, true, and true.

`PDASH_DATA` selects the data directory before config is read; it cannot be set inside that directory's config. Owner PID, authentication credentials, lifecycle history, logs, and browser view preferences are not user configuration. Environment overrides in commands may contain secrets: keep the entire data directory private and out of Git.

```text
.pdash/
  config.json             Settings, workspaces, commands
  owner.lock              Compatibility lock shared with older p-dash versions
  auth/token              Local bearer credential
  logs/output.json        Bounded process output and sequenced events
  logs/*.log              Migrated server/launcher log files
  runtime/lifecycle.json  Latest lifecycle snapshots
  runtime/*.pid           Migrated legacy PID files (not used to restore ownership)
  imports/processes/      Optional YAML seed definitions
  backups/                Original legacy configuration and conflicting files
```

Startup combines the old `workspaces.json` and `processes.json`, validates them, atomically saves config, and archives those inputs. Existing `config.json` takes precedence. It moves the token, logs and lifecycle files to their new locations; group/state files are archived without interpretation. Conflicting destination files are retained and legacy copies get unique backup names. Unknown files remain untouched. Migration runs under the same ownership lock as before, and can resume after interruption. Invalid config fails startup without replacing it. Backups can contain environment secrets too.

Optional YAML seeds add missing IDs only; they do not override saved commands. To permanently remove a seeded command, also disable demo seeding or remove its YAML seed. Logs keep the existing bounded retention, cursor and flush behavior. Log files migrated from old launchers are historical; the current launcher writes server diagnostics to its console.

The token value is preserved on migration, but clients that read its file must switch to `auth/token`. Downgrading requires a stopped application and restoring old-layout files from backups; older versions do not understand `config.json`.
