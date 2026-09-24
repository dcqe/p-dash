package com.example.dash.mcp.tool;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.*;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class WaitForReadyTool {
  @Inject LogWaitService waits;

  @Tool(
      name = "wait_for_ready",
      description = "Wait for a user-specified readiness log regex, up to 30 seconds.",
      structuredContent = true)
  @RunOnVirtualThread
  public LogWaitService.Result execute(
      @ToolArg(description = "Process, readiness regex, cursor and timeoutMs")
          WaitForLogRequest request)
      throws Exception {
    return waits.waitForReady(
        request.processId(), request.regex(), request.afterCursor(), request.timeoutMs());
  }
}
