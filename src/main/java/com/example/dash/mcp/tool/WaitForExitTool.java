package com.example.dash.mcp.tool;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.*;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class WaitForExitTool {
  @Inject LogWaitService waits;

  @Tool(
      name = "wait_for_exit",
      description = "Wait for a process to exit, including its exit code.",
      structuredContent = true)
  @RunOnVirtualThread
  public LogWaitService.Result execute(
      String processId, @ToolArg(defaultValue = "30000") int timeoutMs) throws Exception {
    return waits.waitForExit(processId, timeoutMs);
  }
}
