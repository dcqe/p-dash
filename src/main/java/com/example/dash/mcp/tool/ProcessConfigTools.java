package com.example.dash.mcp.tool;

import com.example.dash.process.*;
import io.quarkiverse.mcp.server.*;
import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

@ApplicationScoped
public class ProcessConfigTools {
  @Inject ProcessManager processes;
  @Inject GroupService groups;

  @Tool(
      name = "create_process",
      description = "Save a command array and absolute workingDirectory. Does not start it.",
      structuredContent = true)
  @RunOnVirtualThread
  public ProcessSnapshot create(ProcessConfig config) {
    return processes.create(config);
  }

  @Tool(
      name = "update_process",
      description = "Replace a stopped process definition. Supply all fields including env.",
      structuredContent = true)
  @RunOnVirtualThread
  public ProcessSnapshot update(ProcessConfig config) {
    return processes.update(config.id(), config);
  }

  @Tool(
      name = "delete_process",
      description = "Delete a stopped process and remove its group memberships",
      structuredContent = true)
  @RunOnVirtualThread
  public Map<String, Boolean> delete(String processId) {
    processes.remove(processId);
    groups.removeMember(processId);
    return Map.of("ok", true);
  }
}
