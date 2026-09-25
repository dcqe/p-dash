package com.example.dash.process;

import com.example.dash.config.LocalState;
import com.example.dash.demo.DemoProcessRunner;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class ProcessConfigLoader {
  @Inject ProcessManager manager;
  @Inject LocalState state;
  @Inject ObjectMapper json;

  @ConfigProperty(name = "pdash.demo.enabled", defaultValue = "true")
  boolean demo;

  public void load() throws Exception {
    migrateLegacy();
    if (demo) {
      for (var name : List.of("healthy", "flaky", "chatty")) {
        try (var input = getClass().getResourceAsStream("/processes/" + name + ".yaml")) {
          loadYaml(input);
        }
      }
    }
    var folder = state.file("processes");
    if (Files.isDirectory(folder))
      try (var files = Files.list(folder)) {
        for (var file :
            files
                .filter(p -> p.toString().endsWith(".yaml") || p.toString().endsWith(".yml"))
                .sorted()
                .toList())
          try (var input = Files.newInputStream(file)) {
            loadYaml(input);
          }
      }
  }

  private void loadYaml(InputStream input) throws Exception {
    var yaml = new ObjectMapper(new YAMLFactory());
    var tree = (ObjectNode) yaml.readTree(input);
    String id = tree.path("id").asText();
    if (manager.list().stream().anyMatch(p -> p.id().equals(id))) return;
    String java =
        Path.of(
                System.getProperty("java.home"),
                "bin",
                System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java")
            .toString();
    String classpath =
        Path.of(DemoProcessRunner.class.getProtectionDomain().getCodeSource().getLocation().toURI())
            .toString();
    var command = (ArrayNode) tree.get("command");
    for (int i = 0; i < command.size(); i++)
      command.set(
          i,
          TextNode.valueOf(
              command
                  .get(i)
                  .asText()
                  .replace("${java}", java)
                  .replace("${demo.classpath}", classpath)));
    tree.put(
        "workingDirectory",
        Path.of(tree.path("workingDirectory").asText(".")).toAbsolutePath().normalize().toString());
    manager.create(json.treeToValue(tree, ProcessConfig.class));
  }

  /** Import user definitions once. Keep the old state file unchanged for rollback. */
  private void migrateLegacy() throws Exception {
    if (Files.exists(state.file("migration-v2.json")) || !Files.exists(state.file("state.json")))
      return;
    var old = json.readTree(state.file("state.json").toFile());
    var notes = new ArrayList<String>();
    for (var item : old.path("commands")) {
      String command = item.path("command").asText();
      String id = item.path("id").asText();
      if (command.contains("scripts\\demo-worker.js")
          || command.contains("scripts/demo-worker.js")) {
        notes.add("Replaced legacy demo " + item.path("name").asText() + " with Java demos");
        continue;
      }
      if (manager.list().stream().anyMatch(p -> p.id().equals(id))) continue;
      try {
        var env = new LinkedHashMap<String, String>();
        item.path("env").fields().forEachRemaining(e -> env.put(e.getKey(), e.getValue().asText()));
        var args =
            System.getProperty("os.name").startsWith("Windows")
                ? List.of("cmd.exe", "/d", "/s", "/c", command)
                : List.of("/bin/sh", "-c", command);
        manager.create(
            new ProcessConfig(
                id,
                item.path("name").asText(),
                args,
                item.path("cwd").asText(),
                env,
                "#bcbcbc",
                "pty"));
      } catch (Exception e) {
        notes.add(
            "Could not import "
                + id
                + ": "
                + e.getMessage()
                + ". Definition remains in state.json");
      }
    }
    state.write("migration-v2.json", Map.of("notes", notes));
  }
}
