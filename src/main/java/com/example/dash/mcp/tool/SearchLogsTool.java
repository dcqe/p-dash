package com.example.dash.mcp.tool;

import com.example.dash.log.LogWaitService;
import io.quarkiverse.mcp.server.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

@ApplicationScoped
public class SearchLogsTool {
  @Inject LogWaitService logs;

  @Tool(
      name = "search_logs",
      description = "Search retained output chunks using a bounded RE2 regex",
      structuredContent = true)
  @io.smallrye.common.annotation.RunOnVirtualThread
  public Map<String, Object> execute(
      @ToolArg(required = false) String processId,
      String regex,
      @ToolArg(defaultValue = "0") long afterCursor,
      @ToolArg(defaultValue = "100") int limit) {
    return Map.of("events", logs.search(processId, regex, afterCursor, limit));
  }
}
