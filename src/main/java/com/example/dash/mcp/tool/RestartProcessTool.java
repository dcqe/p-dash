package com.example.dash.mcp.tool;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.*;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class RestartProcessTool {
  @Inject ProcessManager processes;

  @Tool(
      name = "restart_process",
      description = "Stop and restart a process, assigning a new run ID.",
      structuredContent = true)
  @RunOnVirtualThread
  public ProcessSnapshot execute(@ToolArg(description = "Saved process ID") String processId)
      throws Exception {
    return processes.restart(processId);
  }
}
