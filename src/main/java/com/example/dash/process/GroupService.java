package com.example.dash.process;

import com.example.dash.config.LocalState;
import com.example.dash.log.LogService;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotFoundException;
import java.util.*;

@ApplicationScoped
public class GroupService {
  @Inject LocalState state;
  @Inject ProcessManager manager;
  @Inject LogService logs;
  private final Map<String, ProcessGroup> groups = new LinkedHashMap<>();

  @PostConstruct
  void load() {
    for (var g : state.read("groups.json", ProcessGroup[].class, new ProcessGroup[0]))
      groups.put(g.id(), g);
  }

  public synchronized List<ProcessGroup> list() {
    return List.copyOf(groups.values());
  }

  public synchronized ProcessGroup save(String id, String name, List<String> ids) {
    if (name == null || name.isBlank() || name.length() > 80 || ids == null || ids.size() > 100)
      throw new IllegalArgumentException("Group name and up to 100 process IDs required");
    ids.forEach(manager::status);
    var g =
        new ProcessGroup(
            id == null ? UUID.randomUUID().toString() : id, name, ids.stream().distinct().toList());
    groups.put(g.id(), g);
    persist();
    return g;
  }

  public synchronized void delete(String id) {
    groups.remove(id);
    persist();
  }

  public synchronized void removeMember(String id) {
    groups.replaceAll(
        (key, g) ->
            new ProcessGroup(
                g.id(), g.name(), g.processIds().stream().filter(x -> !x.equals(id)).toList()));
    persist();
  }

  private void persist() {
    var all = list();
    state.write("groups.json", all);
    logs.append("groups", null, null, null, null, null, all);
  }

  public List<Map<String, Object>> control(String id, String action) {
    ProcessGroup group;
    synchronized (this) {
      group = groups.get(id);
    }
    if (group == null) throw new NotFoundException("Group not found");
    return group.processIds().stream()
        .map(
            pid -> {
              try {
                ProcessSnapshot result =
                    switch (action) {
                      case "start" -> manager.start(pid);
                      case "stop" -> manager.stop(pid);
                      case "restart" -> manager.restart(pid);
                      default -> throw new IllegalArgumentException("Unknown action");
                    };
                return Map.<String, Object>of("id", pid, "ok", true, "process", result);
              } catch (Exception e) {
                return Map.<String, Object>of("id", pid, "ok", false, "error", e.getMessage());
              }
            })
        .toList();
  }
}
