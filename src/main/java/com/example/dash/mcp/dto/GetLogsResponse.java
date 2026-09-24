package com.example.dash.mcp.dto;

import com.example.dash.log.*;
import java.util.List;

public record GetLogsResponse(
    List<LogEntry> events, long cursor, long latest, long oldest, boolean truncated) {
  public static GetLogsResponse from(LogPage page) {
    return new GetLogsResponse(
        page.events(), page.cursor(), page.latest(), page.oldest(), page.truncated());
  }
}
