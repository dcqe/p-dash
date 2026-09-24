package com.example.dash.mcp.tool;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.*;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

@ApplicationScoped
public class GetLogsTool {
  @Inject LogService logs;

  @Tool(
      name = "get_logs",
      description = "Read bounded output incrementally. Resume from cursor and check truncated.",
      structuredContent = true)
  @RunOnVirtualThread
  public GetLogsResponse execute(
      @ToolArg(description = "IDs, afterCursor, limit (1-12000), and plain ANSI stripping")
          GetLogsRequest request)
      throws Exception {
    return GetLogsResponse.from(
        logs.getLogs(
            request.processIds() == null ? Set.of() : request.processIds(),
            request.afterCursor(),
            request.limit() == 0 ? 1000 : request.limit(),
            request.plain()));
  }
}
