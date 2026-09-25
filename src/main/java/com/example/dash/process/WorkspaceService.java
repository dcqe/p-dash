package com.example.dash.process;

import com.example.dash.config.LocalState;
import com.example.dash.log.LogService;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import java.util.*;

@ApplicationScoped
public class WorkspaceService {
  @Inject LocalState state;
  @Inject LogService logs;
  @Inject ProcessRegistry registry;
  private final Map<String, Workspace> workspaces = new LinkedHashMap<>();

  @PostConstruct
  void load() {
    for (var w : state.readConfig("workspaces", Workspace[].class))
      workspaces.put(w.id(), w);
    workspaces.putIfAbsent(
        "default", new Workspace("default", "Default", "Your original commands", null, null));
    state.writeConfig("workspaces", workspaces.values());
  }

  public synchronized List<Workspace> list() {
    return List.copyOf(workspaces.values());
  }

  public synchronized Workspace get(String id) {
    var workspace = workspaces.get(id);
    if (workspace == null) throw new NotFoundException("Workspace not found: " + id);
    return workspace;
  }

  public synchronized Workspace save(String id, Workspace body) {
    if (id != null) get(id);
    var w =
        new Workspace(id, body.name(), body.description(), body.color(), body.workingDirectory());
    var next = new LinkedHashMap<>(workspaces);
    next.put(w.id(), w);
    persist(next);
    return w;
  }

  public synchronized void delete(String id) {
    get(id);
    if (id.equals("default"))
      throw new WebApplicationException("The default workspace cannot be deleted", 409);
    if (registry.all().stream().anyMatch(p -> p.config.workspaceId().equals(id)))
      throw new WebApplicationException("Remove the workspace's commands before deleting it", 409);
    var next = new LinkedHashMap<>(workspaces);
    next.remove(id);
    persist(next);
  }

  private void persist(Map<String, Workspace> next) {
    state.writeConfig("workspaces", next.values());
    workspaces.clear();
    workspaces.putAll(next);
    logs.append("workspaces", null, null, null, null, null, list());
  }
}
