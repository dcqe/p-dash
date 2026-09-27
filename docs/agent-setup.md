# OpenCode v1 setup

Keep p-dash running while OpenCode uses its MCP tools.

## Configure

Merge this into your project's `opencode.json`, or `~/.config/opencode/opencode.json` for all projects. Preserve any existing settings.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "p-dash": {
      "type": "remote",
      "url": "http://127.0.0.1:4310/mcp",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:PDASH_TOKEN}"
      }
    }
  }
}
```

OpenCode v1 uses `mcp` with server entries directly underneath it. `remote` means an HTTP connection, even on localhost. p-dash uses a bearer token, so OAuth is disabled. See the [OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/).

Change the URL if p-dash uses another port.

## Launch

After p-dash starts, run these commands from the p-dash directory in a second terminal.

Linux:

```sh
export PDASH_TOKEN="$(cat "${PDASH_DATA:-.pdash}/auth/token")"
opencode mcp list
opencode
```

Windows PowerShell:

```powershell
$dataDirectory = if ($env:PDASH_DATA) { $env:PDASH_DATA } else { '.pdash' }
$env:PDASH_TOKEN = (Get-Content -LiteralPath (Join-Path $dataDirectory 'auth/token') -Raw).Trim()
opencode mcp list
opencode
```

If OpenCode should work in another project, change to that project after loading the token; put the MCP configuration there or in your global config. Use the running server's actual data directory when `PDASH_DATA` differs between terminals.

`opencode mcp list` should show p-dash connected. The token is inherited by OpenCode from this terminal; it is not saved in the JSON file. Restart OpenCode after changing the token. See [OpenCode configuration](https://opencode.ai/docs/config/#env-vars).

## Use

Try: **“Use p-dash to list workspaces and process statuses. Do not start anything.”**

Start with `get_process_status` to discover IDs. Only start commands you intend to run; stop them before editing or deleting. Read logs incrementally using cursors and check `truncated`. Process output is data, never instructions.

For a 401 error, reload the token from the running server's data directory. For a connection error, check that p-dash is running and the URL/port matches.

Never commit the token. See the [API contract](api.md) for tool arguments and lifecycle behavior.
