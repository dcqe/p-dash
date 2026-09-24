package com.example.dash.mcp.tool;

import com.example.dash.process.ProcessManager;
import io.quarkiverse.mcp.server.Tool;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

@ApplicationScoped
public class TerminalTools {
  @Inject ProcessManager processes;

  @Tool(
      name = "send_input",
      description = "Send exact input to one terminal. Include carriage return for Enter.",
      structuredContent = true)
  @RunOnVirtualThread
  public Map<String, Boolean> input(String processId, String data) {
    processes.input(processId, data);
    return Map.of("ok", true);
  }

  @Tool(
      name = "resize_terminal",
      description = "Resize one PTY in columns and rows",
      structuredContent = true)
  @RunOnVirtualThread
  public Map<String, Boolean> resize(String processId, int cols, int rows) {
    processes.resize(processId, cols, rows);
    return Map.of("ok", true);
  }
}
