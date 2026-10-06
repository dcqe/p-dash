package com.example.dash.process;

import java.util.HashSet;
import java.util.List;

/** The on-disk and import/export format for one workspace. */
public record WorkspaceConfig(int version, Workspace workspace, List<ProcessConfig> commands) {
  public static WorkspaceConfig parse(com.fasterxml.jackson.databind.JsonNode tree,
      com.fasterxml.jackson.databind.ObjectMapper mapper) {
    if (tree == null || !tree.isObject() || !tree.path("version").isIntegralNumber()
        || !tree.path("workspace").isObject() || !tree.path("commands").isArray())
      throw new IllegalArgumentException("Workspace JSON requires version, workspace and commands");
    requireId(tree.path("workspace"));
    for (var command : tree.path("commands")) {
      requireId(command);
      if (!command.path("workspaceId").isTextual())
        throw new IllegalArgumentException("Each command requires workspaceId");
    }
    try {
      return mapper.treeToValue(tree, WorkspaceConfig.class);
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid workspace JSON: " + e.getOriginalMessage(), e);
    }
  }

  private static void requireId(com.fasterxml.jackson.databind.JsonNode entry) {
    if (!entry.path("id").isTextual() || entry.path("id").asText().isBlank())
      throw new IllegalArgumentException("Workspace and commands require stable IDs");
  }

  public WorkspaceConfig {
    if (version != 1) throw new IllegalArgumentException("Unsupported workspace config version; expected 1");
    if (workspace == null || commands == null)
      throw new IllegalArgumentException("workspace and commands are required");
    commands = List.copyOf(commands);
    var ids = new HashSet<String>();
    for (var command : commands) {
      if (!command.workspaceId().equals(workspace.id()))
        throw new IllegalArgumentException("Command workspaceId must match the workspace ID");
      if (!ids.add(command.id())) throw new IllegalArgumentException("Duplicate command ID: " + command.id());
    }
  }
}
