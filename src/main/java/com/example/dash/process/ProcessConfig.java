package com.example.dash.process;

import java.nio.file.*;
import java.util.*;

/** Executable plus arguments. A shell is always explicit, never guessed. */
public record ProcessConfig(
    String id,
    String name,
    List<String> command,
    String workingDirectory,
    Map<String, String> env,
    String color,
    String mode,
    ReadinessConfig readiness,
    String workspaceId) {
  public ProcessConfig(
      String id,
      String name,
      List<String> command,
      String workingDirectory,
      Map<String, String> env,
      String color,
      String mode,
      ReadinessConfig readiness) {
    this(id, name, command, workingDirectory, env, color, mode, readiness, "default");
  }

  public ProcessConfig(
      String id,
      String name,
      List<String> command,
      String workingDirectory,
      Map<String, String> env,
      String color,
      String mode) {
    this(id, name, command, workingDirectory, env, color, mode, null);
  }

  public ProcessConfig {
    workspaceId = workspaceId == null ? "default" : workspaceId;
    if (!workspaceId.matches("[a-zA-Z0-9_-]{1,80}"))
      throw new IllegalArgumentException("Invalid workspace ID");
    id = id == null || id.isBlank() ? UUID.randomUUID().toString() : id;
    if (!id.matches("[a-zA-Z0-9_-]{1,80}"))
      throw new IllegalArgumentException("Invalid process ID");
    if (name == null
        || name.isBlank()
        || name.length() > 80
        || name.chars().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException("Name must be 1-80 printable characters");
    if (command == null
        || command.isEmpty()
        || command.size() > 200
        || command.stream().anyMatch(s -> s == null || s.indexOf('\0') >= 0))
      throw new IllegalArgumentException(
          "command must contain an executable and optional arguments");
    command = List.copyOf(command);
    readiness = readiness == null ? ReadinessConfig.defaults(command) : readiness;
    if (readiness.mode().equals("auto")) {
      var defaults = ReadinessConfig.defaults(command);
      readiness = new ReadinessConfig(defaults.mode(), defaults.value(), readiness.timeoutMs());
    }
    if (command.getFirst().isBlank()) throw new IllegalArgumentException("Executable is required");
    if (workingDirectory == null
        || !Path.of(workingDirectory).isAbsolute()
        || !Files.isDirectory(Path.of(workingDirectory)))
      throw new IllegalArgumentException("workingDirectory must be an existing absolute directory");
    env = env == null ? Map.of() : Map.copyOf(env);
    if (env.entrySet().stream()
        .anyMatch(
            e -> !e.getKey().matches("[A-Za-z_][A-Za-z0-9_]*") || e.getValue().indexOf('\0') >= 0))
      throw new IllegalArgumentException("Invalid environment overrides");
    color = color == null || color.isBlank() ? generatedColor(id) : color;
    if (!color.matches("#[0-9a-fA-F]{6}"))
      throw new IllegalArgumentException("color must be #rrggbb");
    mode = mode == null ? "pty" : mode;
    if (!Set.of("pty", "pipe").contains(mode))
      throw new IllegalArgumentException("mode must be pty or pipe");
  }

  /** Stable, vivid assignment so a command keeps the same identity color across restarts. */
  static String generatedColor(String id) {
    String[] colors = {
      "#5B8FF9", "#61DDAA", "#65789B", "#F6BD16", "#7262FD", "#78D3F8", "#9661BC", "#F6903D",
      "#008685", "#F08BB4"
    };
    return colors[Math.floorMod(id.hashCode(), colors.length)];
  }
}
