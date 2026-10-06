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

  public synchronized Workspace importConfig(WorkspaceConfig document) {
    var workspace = document.workspace();
    if (workspaces.containsKey(workspace.id()))
      throw new WebApplicationException("Workspace ID already exists: " + workspace.id(), 409);
    registry.importWorkspace(document);
    workspaces.put(workspace.id(), workspace);
    logs.append("workspaces", null, null, null, null, null, list());
    for (var command : document.commands())
      logs.append("state", command.id(), null, null, null, registry.get(command.id()).snapshot(), null);
    return workspace;
  }

  public synchronized WorkspaceConfig exportConfig(String id) {
    return new WorkspaceConfig(1, get(id),
        Arrays.stream(state.readConfig("commands", ProcessConfig[].class))
            .filter(command -> command.workspaceId().equals(id)).toList());
  }

  public synchronized String configPath(String id) {
    get(id);
    return state.file("config.json").toString();
  }

  public synchronized void openConfig(String id) {
    var path = configPath(id);
    try {
      String os = System.getProperty("os.name");
      if (os.startsWith("Windows"))
        new ProcessBuilder("rundll32.exe", "url.dll,FileProtocolHandler", path).start();
      else
        new ProcessBuilder(os.startsWith("Mac") ? "open" : "xdg-open", path).start();
    } catch (java.io.IOException e) {
      throw new WebApplicationException("Could not open the config file; open it using the displayed path.", 500);
    }
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
    var commands = registry.all().stream().filter(p -> p.config.workspaceId().equals(id)).toList();
    var reserved = new ArrayList<ManagedProcess>();
    try {
      // Reserve stopped definitions under their lifecycle locks before removing any of them.
      // Creation holds this workspace lock; starts and edits reject reserved definitions.
      for (var p : commands) {
        synchronized (p) {
          if (p.terminal != null)
            throw new WebApplicationException("Stop all commands in the workspace before deleting it", 409);
          p.removing = true;
          reserved.add(p);
        }
      }
      registry.removeAll(commands.stream().map(p -> p.config.id()).toList());
      for (var p : commands)
        logs.append("removed", p.config.id(), null, null, null, null, null);
      var next = new LinkedHashMap<>(workspaces);
      next.remove(id);
      persist(next);
    } finally {
      for (var p : reserved) {
        synchronized (p) {
          p.removing = false;
        }
      }
    }
  }

  private void persist(Map<String, Workspace> next) {
    state.writeConfig("workspaces", next.values());
    workspaces.clear();
    workspaces.putAll(next);
    logs.append("workspaces", null, null, null, null, null, list());
  }
}
