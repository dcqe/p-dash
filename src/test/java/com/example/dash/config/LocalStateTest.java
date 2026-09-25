package com.example.dash.config;

import static org.junit.jupiter.api.Assertions.*;

import com.example.dash.process.ProcessConfig;
import com.example.dash.process.Workspace;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalStateTest {
  @TempDir Path directory;
  final ObjectMapper mapper = new ObjectMapper();

  LocalState open() {
    var state = new LocalState();
    state.directory = directory.toString();
    state.mapper = mapper;
    state.init();
    return state;
  }

  @Test void migrationPreservesDefinitionsCredentialsHistoryAndUnknownFiles() throws Exception {
    var command = new ProcessConfig("saved", "Saved", List.of("java", "-version"),
        directory.toString(), Map.of("EXAMPLE", "preserve-me"), null, "pipe");
    mapper.writeValue(directory.resolve("processes.json").toFile(), List.of(command));
    mapper.writeValue(directory.resolve("workspaces.json").toFile(), List.of(
        new Workspace("default", "Personal", "description", null, directory.toString())));
    for (var name : List.of("token", "logs.json", "lifecycle.json", "server.log", "groups.json", "state.json", "custom.txt"))
      Files.writeString(directory.resolve(name), "original-" + name);
    var state = open();
    try {
      assertEquals(command, state.readConfig("commands", ProcessConfig[].class)[0]);
      assertEquals("Personal", state.readConfig("workspaces", Workspace[].class)[0].name());
      assertEquals("original-token", Files.readString(state.file("auth/token")));
      assertEquals("original-logs.json", Files.readString(state.file("logs/output.json")));
      assertEquals("original-lifecycle.json", Files.readString(state.file("runtime/lifecycle.json")));
      assertEquals("original-server.log", Files.readString(state.file("logs/server.log")));
      assertTrue(Files.exists(state.file("backups/processes.json")));
      assertFalse(Files.exists(state.file("processes.json")));
      assertTrue(Files.exists(state.file("custom.txt")));
      state.writeConfig("workspaces", List.of(new Workspace("default", "Edited", null, null, directory.toString())));
      assertEquals(command, mapper.treeToValue(mapper.readTree(state.file("config.json").toFile()).path("commands").get(0), ProcessConfig.class));
    } finally { state.unlock(); }
    var reopened = open();
    try { assertEquals("Edited", reopened.readConfig("workspaces", Workspace[].class)[0].name()); }
    finally { reopened.unlock(); }
  }

  @Test void invalidConfigIsPreservedAndReleasesLock() throws Exception {
    var path = directory.resolve("config.json");
    String invalid = "{\"version\":99,\"commands\":[],\"workspaces\":[]}";
    Files.writeString(path, invalid);
    assertThrows(IllegalStateException.class, this::open);
    assertEquals(invalid, Files.readString(path));
    Files.writeString(path, "{\"version\":1,\"commands\":[],\"workspaces\":[]}");
    var state = open();
    state.unlock();
  }

  @Test void existingConfigWinsAndConflictingFilesAreKept() throws Exception {
    var first = open();
    first.unlock();
    Files.writeString(directory.resolve("processes.json"), "invalid legacy content");
    Files.writeString(directory.resolve("auth/token"), "current");
    Files.writeString(directory.resolve("token"), "old");
    var state = open();
    try {
      assertEquals(0, state.readConfig("commands", ProcessConfig[].class).length);
      assertEquals("current", Files.readString(state.file("auth/token")));
      try (var backups = Files.list(state.file("backups"))) {
        assertTrue(backups.anyMatch(p -> p.getFileName().toString().startsWith("token-")));
      }
    } finally { state.unlock(); }
  }

  @Test void unknownWorkspaceAndDuplicateIdsDoNotOverwriteConfig() throws Exception {
    var state = open();
    state.unlock();
    var config = mapper.readTree(directory.resolve("config.json").toFile());
    var command = new ProcessConfig("saved", "Saved", List.of("java"), directory.toString(), Map.of(), null, "pipe", null, "missing");
    ((com.fasterxml.jackson.databind.node.ObjectNode) config).set("commands", mapper.valueToTree(List.of(command)));
    mapper.writeValue(directory.resolve("config.json").toFile(), config);
    var before = Files.readString(directory.resolve("config.json"));
    assertThrows(IllegalStateException.class, this::open);
    assertEquals(before, Files.readString(directory.resolve("config.json")));
    command = new ProcessConfig("saved", "Saved", List.of("java"), directory.toString(), Map.of(), null, "pipe");
    ((com.fasterxml.jackson.databind.node.ObjectNode) config).set("commands", mapper.valueToTree(List.of(command, command)));
    mapper.writeValue(directory.resolve("config.json").toFile(), config);
    assertThrows(IllegalStateException.class, this::open);
  }
}
