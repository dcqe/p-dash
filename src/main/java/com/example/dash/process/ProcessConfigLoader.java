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
    if (demo && state.demoEnabled()) {
      for (var name : List.of("healthy", "flaky", "chatty")) {
        try (var input = getClass().getResourceAsStream("/processes/" + name + ".yaml")) {
          loadYaml(input);
        }
      }
    }
    var folder = state.file("imports/processes");
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

}
