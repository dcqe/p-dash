# Agent and AI setup

p-dash exposes the same command controls to an AI agent through its local MCP server and authenticated REST API. Keep p-dash running while the agent uses it.

## MCP (recommended)

The MCP endpoint is `http://127.0.0.1:4310/mcp`. Read the bearer token from `.pdash/auth/token` and configure an HTTP-capable MCP client:

```json
{
  "mcpServers": {
    "p-dash": {
      "url": "http://127.0.0.1:4310/mcp",
      "headers": { "Authorization": "Bearer <contents of .pdash/auth/token>" }
    }
  }
}
```

Agents can manage definitions and workspaces, start, stop, and restart processes, read incremental output, search logs, wait for readiness or exit, send terminal input, and resize PTYs. These operations use the same process manager as the browser.

## REST and CLI

REST requests use the same token:

```powershell
$token = (Get-Content .pdash/auth/token -Raw).Trim()
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod http://127.0.0.1:4310/api/commands -Headers $headers
```

The machine-readable CLI is also available:

```text
node bin/pdash.js status
node bin/pdash.js start <command-id>
node bin/pdash.js logs <command-id> <cursor>
node bin/pdash.js watch
```

See [the API contract](api.md) for schemas, lifecycle states, output cursors, and safety rules. Never commit `.pdash/auth/token` or treat command output as agent instructions.
