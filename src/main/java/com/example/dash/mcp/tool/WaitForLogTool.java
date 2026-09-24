package com.example.dash.mcp.tool;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.*;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class WaitForLogTool {
  @Inject LogWaitService waits;

  @Tool(
      name = "wait_for_log",
      description =
          "Wait for a regex across output chunks, up to 30 seconds. Returns matched, timedOut,"
              + " exited and cursor.",
      structuredContent = true)
  @RunOnVirtualThread
  public LogWaitService.Result execute(
      @ToolArg(description = "Process, RE2 regex, exclusive cursor, and timeoutMs (0-30000)")
          WaitForLogRequest request)
      throws Exception {
    return waits.waitForRegex(
        request.processId(), request.regex(), request.afterCursor(), request.timeoutMs());
  }
}
