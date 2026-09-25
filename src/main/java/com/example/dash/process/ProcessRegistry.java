package com.example.dash.process;

import com.example.dash.config.LocalState;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import java.util.*;

@ApplicationScoped
public class ProcessRegistry {
  @Inject LocalState state;
  @Inject com.fasterxml.jackson.databind.ObjectMapper mapper;
  private final Map<String, ManagedProcess> processes = new LinkedHashMap<>();
  private final Map<String, ProcessSnapshot> history = new LinkedHashMap<>();

  @PostConstruct
  void load() {
    var definitions = state.readConfig("commands", ProcessConfig[].class);
    for (var c : definitions) processes.put(c.id(), new ManagedProcess(c));
    var saved = state.read("runtime/lifecycle.json", ProcessSnapshot[].class, new ProcessSnapshot[0]);
    if (!java.nio.file.Files.exists(state.file("runtime/lifecycle.json"))) {
      // Recover known prior runs on upgrade from retained state events, without reviving PIDs.
      var recovered = new LinkedHashMap<String, ProcessSnapshot>();
      var oldLogs =
          state.read(
              "logs/output.json",
              com.fasterxml.jackson.databind.JsonNode.class,
              mapper.createObjectNode());
      for (var entry : oldLogs.path("entries")) {
        if (!entry.path("type").asText().equals("state") || !entry.path("process").isObject())
          continue;
        var node =
            (com.fasterxml.jackson.databind.node.ObjectNode) entry.path("process").deepCopy();
        if (node.path("runId").isMissingNode() || node.path("runId").isNull())
          node.put("status", "not_started");
        var snapshot = mapper.convertValue(node, ProcessSnapshot.class);
        recovered.put(snapshot.id(), snapshot);
      }
      saved = recovered.values().toArray(ProcessSnapshot[]::new);
    }
    for (var old : saved) {
      var p = processes.get(old.id());
      if (p == null) continue;
      p.status = old.status();
      p.runId = old.runId();
      p.startedAt = old.startedAt();
      p.endedAt = old.endedAt();
      p.exitCode = old.exitCode();
      p.error = old.error();
      if (p.status == ProcessStatus.FAILED
          && Objects.equals(p.exitCode, 0)
          && p.error != null
          && p.error.contains("exited unexpectedly")) {
        p.status = ProcessStatus.EXITED;
        p.error = null;
      }
      if (Set.of(ProcessStatus.STARTING, ProcessStatus.RUNNING, ProcessStatus.STOPPING)
          .contains(p.status)) {
        p.status = ProcessStatus.FAILED;
        p.error =
            "Previous run was interrupted when p-dash exited; process ownership was not restored";
        p.endedAt = java.time.Instant.now().toString();
      }
      history.put(old.id(), p.snapshot());
    }
    state.write("runtime/lifecycle.json", history.values());
  }

  public synchronized ManagedProcess get(String id) {
    var p = processes.get(id);
    if (p == null) throw new NotFoundException("Process not found: " + id);
    return p;
  }

  public synchronized List<ManagedProcess> all() {
    return List.copyOf(processes.values());
  }

  public synchronized void add(ProcessConfig config) {
    if (processes.containsKey(config.id()))
      throw new IllegalArgumentException("Process ID already exists");
    processes.put(config.id(), new ManagedProcess(config));
    save();
  }

  public synchronized void remove(String id) {
    processes.remove(id);
    history.remove(id);
    state.write("runtime/lifecycle.json", history.values());
    save();
  }

  public synchronized void save() {
    state.writeConfig("commands", processes.values().stream().map(p -> p.config).toList());
  }

  public synchronized void recordLifecycle(ProcessSnapshot snapshot) {
    history.put(snapshot.id(), snapshot);
    state.write("runtime/lifecycle.json", history.values());
  }
}
