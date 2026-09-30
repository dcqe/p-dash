# Features

- **Workspaces:** organize commands by project, with a default working directory and separate browser view preferences. Switching workspaces leaves processes running; batch controls apply to the current workspace.
- **Process control:** create, edit, start, stop, and restart commands using PTY or pipe mode. Definitions and lifecycle history persist; commands start only on request.
- **Startup readiness:** use a log pattern, HTTP response, or successful spawn to decide when a command is ready. A startup timeout stops the process; readiness is not continuous health monitoring.
- **Interactive terminals:** each process has its own terminal for output and keyboard input.
- **Combined output:** merge selected commands, filter text, pause display, and copy output. Capture continues while display is paused; history is bounded.
- **Agent access:** authenticated REST and embedded MCP expose process controls, status, input, log search, and waits.

See [setup](../README.md), [configuration](configuration.md), and [API](api.md) for usage details.
