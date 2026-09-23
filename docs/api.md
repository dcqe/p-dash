# Local API contract

Base URL: `http://127.0.0.1:4310/api`. All endpoints except browser-only `/session` require `Authorization: Bearer <contents of .pdash/token>`. Bodies and responses are JSON. Errors return `{ "error": "message" }` with 400 (validation), 401/403 (access), 404 (missing) or 409 (state conflict). Commands run as the local OS user.

| Method | Path                    | Body / result                                                   |
| ------ | ----------------------- | --------------------------------------------------------------- |
| GET    | `/status`               | version, platform, cwd, uptime, cursor, commands, groups        |
| GET    | `/commands`             | command definitions and live states; env values omitted         |
| POST   | `/commands`             | `{name,command,cwd,color?,env?}`; returns saved command         |
| PATCH  | `/commands/:id`         | any definition fields; only when stopped; omitted env preserved |
| DELETE | `/commands/:id`         | delete a stopped command; remove group memberships              |
| POST   | `/commands/:id/start`   | idempotent; returns state after PTY initialization              |
| POST   | `/commands/:id/stop`    | waits for graceful exit or forced termination                   |
| POST   | `/commands/:id/restart` | waits for stop, starts a new run                                |
| POST   | `/commands/:id/input`   | `{data: "text\r"}`; exact terminal input; `\u0003` = Ctrl-C     |
| POST   | `/commands/:id/resize`  | `{cols: 120, rows: 30}`; cols 2–500, rows 2–200                 |
| GET    | `/groups`               | saved groups                                                    |
| POST   | `/groups`               | `{name,processIds: [id,...]}`                                   |
| PUT    | `/groups/:id`           | replace group with `{name,processIds}`                          |
| DELETE | `/groups/:id`           | remove group; leaves member processes alone                     |
| POST   | `/groups/:id/start`     | batch start; array of `{id,ok,process?,error?}`                 |
| POST   | `/groups/:id/stop`      | batch stop; same per-member result                              |
| POST   | `/groups/:id/restart`   | batch restart; same per-member result                           |
| GET    | `/logs`                 | bounded, cursor-based output and lifecycle events               |
| GET    | `/events?after=0`       | authenticated SSE snapshot, then live events                    |

Definitions accept an absolute existing directory and shell command. `env` is a string-to-string map; `color` is a six-digit hex color. A command state includes `status` (`stopped`, `starting`, `running`, `stopping`, `exited`, `failed`), `pid`, `runId`, timestamps and exit code. IDs are opaque UUIDs. Check actual output for readiness, not just `status`.

## Read and resume

`GET /logs?ids=id1,id2&after=123&limit=1000&plain=true`

`ids` is optional (all processes by default). `after` is an exclusive global sequence cursor. `limit` defaults to 2,000, max 12,000. `plain=true` removes terminal controls; the default retains ANSI output.

```json
{
  "events": [
    {
      "seq": 124,
      "time": "2026-09-23T18:00:00.000Z",
      "type": "output",
      "processId": "...",
      "runId": "...",
      "data": "Listening on :8081\r\n"
    }
  ],
  "cursor": 124,
  "latest": 140,
  "oldest": 1,
  "truncated": false
}
```

Read again with `after=cursor` until caught up. A filtered query may return no records and advance to `latest`. Never infer failure from an empty response. `truncated=true` means some events after your requested cursor have expired; retention is global. Each output event is a chunk, not necessarily a line, and escape sequences may span chunks. Agents that need a rendered screen should not treat raw chunks as a terminal screenshot.

`/events` begins with a `snapshot` containing current commands, groups and retained events after the requested cursor. Subsequent SSE `data:` records are `output`, `state`, `groups` or `removed`. Each has an increasing `seq`; reconnect with the last consumed sequence and deduplicate by sequence. Heartbeat comments keep idle streams alive. Slow subscribers are disconnected when queued output exceeds 1 MiB. Browser refresh replay is recent history, not a lossless terminal checkpoint.

## CLI

`node bin/pdash.js help` lists commands. Output is JSON, except `watch`, which emits the raw SSE feed. JSON command definitions can be passed as one quoted argument to `create` / `update`. Shell escaping differs between PowerShell, cmd.exe and Unix shells; MCP or direct JSON HTTP requests avoid that ambiguity. CLI failures exit with status 1 and print a JSON error to stderr.

## MCP tools

`status`, `create_command`, `update_command`, `delete_command`, `control_command`, `read_output`, `send_input`, `resize_terminal`, `save_group`, `delete_group`, `control_group`.

Tools expose structured input schemas and return JSON in MCP text content. Errors use `isError: true`. The adapter does not own or spawn a separate daemon. To monitor, poll `read_output` using the cursor or use SSE from an HTTP-capable agent. Avoid repeating whole-history reads.
