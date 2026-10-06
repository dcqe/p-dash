package com.example.dash.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.example.dash.process.ProcessConfig;
import com.example.dash.process.Workspace;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** The only place that knows where private local state lives. */
@ApplicationScoped
public class LocalState {
  @ConfigProperty(name = "pdash.data")
  String directory;

  @Inject ObjectMapper mapper;
  private Path root;
  private java.nio.channels.FileChannel lockChannel;
  private java.nio.channels.FileLock lock;
  private ObjectNode config;

  @PostConstruct
  void init() {
    root = Path.of(directory).toAbsolutePath().normalize();
    try {
      Files.createDirectories(root);
      lockChannel =
          java.nio.channels.FileChannel.open(
              root.resolve("owner.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
      lock = lockChannel.tryLock();
      if (lock == null) throw new IllegalStateException("Another p-dash instance owns " + root);
      for (var folder : java.util.List.of("logs", "runtime", "auth", "imports"))
        Files.createDirectories(root.resolve(folder));
      loadConfig();
    } catch (IOException e) {
      closeAfterFailure();
      throw new IllegalStateException(e);
    } catch (RuntimeException e) {
      closeAfterFailure();
      throw e;
    }
  }

  private void closeAfterFailure() {
    try { unlock(); } catch (IOException ignored) { }
  }

  private void loadConfig() throws IOException {
    if (Files.exists(file("config.json"))) {
      var tree = mapper.readTree(file("config.json").toFile());
      if (!(tree instanceof ObjectNode object)) throw new IOException("config.json must be an object");
      config = object;
    } else {
      for (var name : java.util.List.of("processes.json", "workspaces.json", "state.json", "groups.json", "token", "logs.json", "lifecycle.json")) {
        if (Files.exists(file(name)))
          throw new IOException("Unsupported state layout in " + root + "; use a clean data directory or supply current config.json");
      }
      config = mapper.createObjectNode();
      config.put("version", 1);
      config.putArray("workspaces");
      config.putArray("commands");
    }
    if (!config.path("version").isIntegralNumber() || config.path("version").asInt() != 1)
      throw new IOException("Unsupported config.json version; expected 1");
    if (!config.has("settings")) {
      config.putObject("settings").put("port", 4310).put("openBrowser", true).put("demoEnabled", true);
    }
    var settings = config.path("settings");
    if (!settings.isObject()
        || !settings.path("port").isIntegralNumber()
        || settings.path("port").asInt() < 1 || settings.path("port").asInt() > 65535
        || !settings.path("openBrowser").isBoolean() || !settings.path("demoEnabled").isBoolean())
      throw new IOException("settings requires port (1-65535), openBrowser and demoEnabled (booleans)");
    if (!config.path("commands").isArray() || !config.path("workspaces").isArray())
      throw new IOException("config.json requires commands and workspaces arrays");
    for (var section : java.util.List.of("commands", "workspaces"))
      for (var entry : config.path(section))
        if (!entry.path("id").isTextual() || entry.path("id").asText().isBlank())
          throw new IOException("Each " + section + " entry requires a stable id");
    var workspaceIds = new java.util.HashSet<String>();
    for (var w : mapper.treeToValue(config.get("workspaces"), Workspace[].class))
      if (!workspaceIds.add(w.id())) throw new IOException("Duplicate workspace ID: " + w.id());
    workspaceIds.add("default");
    var commandIds = new java.util.HashSet<String>();
    for (var c : mapper.treeToValue(config.get("commands"), ProcessConfig[].class)) {
      if (!commandIds.add(c.id())) throw new IOException("Duplicate command ID: " + c.id());
      if (!workspaceIds.contains(c.workspaceId())) throw new IOException("Unknown workspace: " + c.workspaceId());
    }
    write("config.json", config);
  }

  public synchronized <T> T readConfig(String section, Class<T> type) {
    try { return mapper.treeToValue(config.get(section), type); }
    catch (IOException e) { throw new IllegalStateException("Invalid configuration section: " + section, e); }
  }

  public synchronized void writeConfig(String section, Object value) {
    var next = config.deepCopy();
    next.set(section, mapper.valueToTree(value));
    write("config.json", next);
    config = next;
  }

  public synchronized void importWorkspace(com.example.dash.process.WorkspaceConfig document) {
    var next = config.deepCopy();
    ((com.fasterxml.jackson.databind.node.ArrayNode) next.get("workspaces"))
        .add(mapper.valueToTree(document.workspace()));
    var commands = (com.fasterxml.jackson.databind.node.ArrayNode) next.get("commands");
    for (var command : document.commands()) commands.add(mapper.valueToTree(command));
    write("config.json", next);
    config = next;
  }

  public boolean demoEnabled() { return config.path("settings").path("demoEnabled").asBoolean(); }

  @jakarta.annotation.PreDestroy
  void unlock() throws IOException {
    if (lock != null) lock.release();
    if (lockChannel != null) lockChannel.close();
  }

  public Path file(String name) {
    return root.resolve(name);
  }

  public <T> T read(String name, Class<T> type, T fallback) {
    if (!Files.exists(file(name))) return fallback;
    try {
      return mapper.readValue(file(name).toFile(), type);
    } catch (IOException e) {
      throw new IllegalStateException(
          "Cannot read " + file(name) + "; original file was preserved", e);
    }
  }

  public synchronized void write(String name, Object value) {
    Path temporary = file(name + ".tmp");
    try {
      mapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), value);
      restrict(temporary);
      try {
        Files.move(
            temporary,
            file(name),
            StandardCopyOption.ATOMIC_MOVE,
            StandardCopyOption.REPLACE_EXISTING);
      } catch (AtomicMoveNotSupportedException e) {
        Files.move(temporary, file(name), StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException e) {
      throw new IllegalStateException("Cannot save " + file(name), e);
    }
  }

  public static void restrict(Path file) throws IOException {
    if (Files.getFileStore(file).supportsFileAttributeView("posix"))
      Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
  }
}
