package com.example.dash.mcp.tool;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.*;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class StopProcessTool {
  @Inject ProcessManager processes;

  @Tool(
      name = "stop_process",
      description = "Stop a process and its descendants; wait for termination.",
      structuredContent = true)
  @RunOnVirtualThread
  public ProcessSnapshot execute(@ToolArg(description = "Saved process ID") String processId)
      throws Exception {
    return processes.stop(processId);
  }
}
