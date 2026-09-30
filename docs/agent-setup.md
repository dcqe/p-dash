# OpenCode setup

Keep p-dash running. Merge this into your project's `opencode.json` or global `~/.config/opencode/opencode.json`, preserving existing settings:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "p-dash": {
      "type": "remote",
      "url": "http://127.0.0.1:4310/mcp",
      "enabled": true,
      "oauth": false,
      "headers": {"Authorization": "Bearer {env:PDASH_TOKEN}"}
    }
  }
}
```

Load the running server's token from the p-dash directory before launching OpenCode.

Linux:

```sh
export PDASH_TOKEN="$(cat "${PDASH_DATA:-.pdash}/auth/token")"
```

Windows PowerShell:

```powershell
$dataDirectory = if ($env:PDASH_DATA) { $env:PDASH_DATA } else { '.pdash' }
$env:PDASH_TOKEN = (Get-Content -LiteralPath (Join-Path $dataDirectory 'auth/token') -Raw).Trim()
```

Then change to your project, run `opencode mcp list` to check the connection, and launch `opencode`. Match the URL/port and token to the running server; never commit the token.

Try: **“Use p-dash to list workspaces and process statuses. Do not start anything.”**

See the [API contract](api.md) for tools and the [OpenCode MCP reference](https://opencode.ai/docs/mcp-servers/) for client configuration.
