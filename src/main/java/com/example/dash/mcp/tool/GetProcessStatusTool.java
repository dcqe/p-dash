package com.example.dash.mcp.tool;

import com.example.dash.log.LogService;
import com.example.dash.mcp.dto.ProcessStatusResponse;
import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class GetProcessStatusTool {
  @Inject ProcessManager processes;
  @Inject GroupService groups;
  @Inject LogService logs;

  @Tool(
      name = "get_process_status",
      description = "List saved process definitions, live states, groups and output cursor",
      structuredContent = true)
  @io.smallrye.common.annotation.RunOnVirtualThread
  public ProcessStatusResponse execute() {
    return new ProcessStatusResponse(processes.list(), groups.list(), logs.cursor());
  }
}
