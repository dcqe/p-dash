package com.example.dash.mcp.tool;

import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.*;

@ApplicationScoped
public class GroupTools {
  @Inject GroupService groups;

  @Tool(
      name = "save_group",
      description = "Create or replace a saved group for merged output and batch control",
      structuredContent = true)
  @RunOnVirtualThread
  public ProcessGroup save(
      @ToolArg(required = false) String id, String name, List<String> processIds) {
    return groups.save(id, name, processIds);
  }

  @Tool(
      name = "delete_group",
      description = "Remove a group without stopping its members",
      structuredContent = true)
  @RunOnVirtualThread
  public Map<String, Boolean> delete(String groupId) {
    groups.delete(groupId);
    return Map.of("ok", true);
  }

  @Tool(
      name = "control_group",
      description = "Start, stop or restart all members; check each member result",
      structuredContent = true)
  @RunOnVirtualThread
  public Map<String, Object> control(String groupId, String action) {
    return Map.of("results", groups.control(groupId, action));
  }
}
