package com.example.dash.mcp.tool;

import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

@ApplicationScoped
public class WorkspaceTools {
  @Inject WorkspaceService workspaces;

  @Tool(
      name = "save_workspace",
      description =
          "Create or replace workspace settings. Omit id to create. Does not start commands.",
      structuredContent = true)
  @RunOnVirtualThread
  public Workspace save(@ToolArg(required = false) String id, Workspace config) {
    return workspaces.save(id, config);
  }

  @Tool(
      name = "delete_workspace",
      description = "Delete an empty, non-default workspace",
      structuredContent = true)
  @RunOnVirtualThread
  public Map<String, Boolean> delete(String workspaceId) {
    workspaces.delete(workspaceId);
    return Map.of("ok", true);
  }
}
