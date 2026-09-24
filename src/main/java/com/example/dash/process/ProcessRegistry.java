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
  private final Map<String, ManagedProcess> processes = new LinkedHashMap<>();

  @PostConstruct
  void load() {
    for (var c : state.read("processes.json", ProcessConfig[].class, new ProcessConfig[0]))
      processes.put(c.id(), new ManagedProcess(c));
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
    save();
  }

  public synchronized void save() {
    state.write("processes.json", processes.values().stream().map(p -> p.config).toList());
  }
}
