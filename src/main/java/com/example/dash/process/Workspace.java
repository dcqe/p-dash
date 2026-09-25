package com.example.dash.process;

import java.nio.file.*;
import java.util.UUID;

public record Workspace(
    String id, String name, String description, String color, String workingDirectory) {
  public Workspace {
    id = id == null ? UUID.randomUUID().toString() : id;
    if (!id.matches("[a-zA-Z0-9_-]{1,80}"))
      throw new IllegalArgumentException("Invalid workspace ID");
    if (name == null
        || name.isBlank()
        || name.length() > 80
        || name.chars().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException("Workspace name must be 1-80 printable characters");
    description = description == null ? "" : description;
    if (description.length() > 240)
      throw new IllegalArgumentException("Description must be at most 240 characters");
    color = color == null ? "#5B8FF9" : color;
    if (!color.matches("#[0-9a-fA-F]{6}"))
      throw new IllegalArgumentException("color must be #rrggbb");
    workingDirectory =
        workingDirectory == null
            ? Path.of("").toAbsolutePath().normalize().toString()
            : workingDirectory;
    if (!Path.of(workingDirectory).isAbsolute() || !Files.isDirectory(Path.of(workingDirectory)))
      throw new IllegalArgumentException(
          "Workspace directory must be an existing absolute directory");
  }
}
