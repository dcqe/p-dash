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

  @Test void configSectionsPreserveOtherSectionsAndSurviveRestart() throws Exception {
    var command = new ProcessConfig("saved", "Saved", List.of("java", "-version"),
        directory.toString(), Map.of("EXAMPLE", "preserve-me"), null, "pipe");
    var state = open();
    try {
      assertEquals(0, state.readConfig("commands", ProcessConfig[].class).length);
      assertFalse(Files.exists(state.file("backups")));
      state.writeConfig("commands", List.of(command));
      state.writeConfig("workspaces", List.of(
          new Workspace("default", "Personal", "description", null, directory.toString())));
      assertEquals(command, mapper.treeToValue(
          mapper.readTree(state.file("config.json").toFile()).path("commands").get(0), ProcessConfig.class));
    } finally { state.unlock(); }
    var reopened = open();
    try {
      assertEquals("Personal", reopened.readConfig("workspaces", Workspace[].class)[0].name());
      assertEquals(command, reopened.readConfig("commands", ProcessConfig[].class)[0]);
    } finally { reopened.unlock(); }
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

  @Test void incompatibleStateIsRejectedWithoutConversionOrDeletion() throws Exception {
    var original = "[{\"old\":true}]";
    Files.writeString(directory.resolve("processes.json"), original);
    assertThrows(IllegalStateException.class, this::open);
    assertEquals(original, Files.readString(directory.resolve("processes.json")));
    assertFalse(Files.exists(directory.resolve("config.json")));
    assertFalse(Files.exists(directory.resolve("backups")));
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
