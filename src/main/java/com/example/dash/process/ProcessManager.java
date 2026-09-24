package com.example.dash.process;

import com.example.dash.log.LogService;
import com.example.dash.terminal.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.time.Instant;
import java.util.*;

@ApplicationScoped
public class ProcessManager {
  @Inject ProcessRegistry registry;
  @Inject TerminalService terminals;
  @Inject LogService logs;
  private volatile boolean closing;

  public List<ProcessSnapshot> list() {
    return registry.all().stream().map(ManagedProcess::snapshot).toList();
  }

  public ProcessSnapshot status(String id) {
    return registry.get(id).snapshot();
  }

  public ProcessConfig definition(String id) {
    return registry.get(id).config;
  }

  public ProcessSnapshot create(ProcessConfig config) {
    registry.add(config);
    return changed(registry.get(config.id()));
  }

  public ProcessSnapshot update(String id, ProcessConfig config) {
    var p = registry.get(id);
    synchronized (p) {
      ensureStopped(p);
      if (!id.equals(config.id())) throw new IllegalArgumentException("ID cannot change");
      p.config = config;
      registry.save();
      return changed(p);
    }
  }

  public void remove(String id) {
    var p = registry.get(id);
    synchronized (p) {
      ensureStopped(p);
      registry.remove(id);
      logs.append("removed", id, null, null, null, null, null);
    }
  }

  public ProcessSnapshot start(String id) {
    var p = registry.get(id);
    synchronized (p) {
      if (closing) throw new WebApplicationException("Server is shutting down", 409);
      if (p.terminal != null && p.terminal.alive()) return p.snapshot();
      p.status = ProcessStatus.STARTING;
      p.runId = UUID.randomUUID().toString();
      p.startedAt = Instant.now().toString();
      p.endedAt = null;
      p.exitCode = null;
      p.error = null;
      changed(p);
      try {
        var session = terminals.start(p.config, p.runId);
        p.terminal = session;
        p.status = ProcessStatus.RUNNING;
        changed(p);
        Thread.ofVirtual()
            .name("exit-" + id)
            .start(
                () -> {
                  try {
                    int code = session.awaitExit();
                    synchronized (p) {
                      if (p.terminal != session) return;
                      p.exitCode = code;
                      p.endedAt = Instant.now().toString();
                      p.terminal = null;
                      p.status = code == 0 ? ProcessStatus.EXITED : ProcessStatus.FAILED;
                      changed(p);
                    }
                  } catch (Exception e) {
                    synchronized (p) {
                      if (p.terminal == session) {
                        p.status = ProcessStatus.FAILED;
                        p.error = e.getMessage();
                        changed(p);
                      }
                    }
                  }
                });
      } catch (Exception e) {
        p.status = ProcessStatus.FAILED;
        p.error = e.getMessage();
        p.endedAt = Instant.now().toString();
        changed(p);
        throw new IllegalStateException(
            "Cannot start " + p.config.name() + ": " + e.getMessage(), e);
      }
      return p.snapshot();
    }
  }

  public ProcessSnapshot stop(String id) {
    var p = registry.get(id);
    synchronized (p) {
      if (p.terminal == null) return p.snapshot();
      p.status = ProcessStatus.STOPPING;
      changed(p);
      try {
        terminals.stop(p.terminal);
        p.exitCode = p.terminal.awaitExit();
        p.terminal = null;
        p.status = ProcessStatus.STOPPED;
        p.endedAt = Instant.now().toString();
        return changed(p);
      } catch (Exception e) {
        p.error = e.getMessage();
        changed(p);
        throw new IllegalStateException("Cannot stop " + p.config.name(), e);
      }
    }
  }

  public ProcessSnapshot restart(String id) {
    var p = registry.get(id);
    synchronized (p) {
      stop(id);
      return start(id);
    }
  }

  public void input(String id, String data) {
    if (data == null || data.length() > 16384)
      throw new IllegalArgumentException("Input must be at most 16384 characters");
    var p = registry.get(id);
    synchronized (p) {
      if (p.terminal == null || !p.terminal.alive())
        throw new WebApplicationException("Process is not running", 409);
      try {
        p.terminal.input(data);
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    }
  }

  public void resize(String id, int cols, int rows) {
    if (cols < 2 || cols > 500 || rows < 2 || rows > 200)
      throw new IllegalArgumentException("Terminal dimensions out of range");
    var p = registry.get(id);
    synchronized (p) {
      if (p.terminal != null) p.terminal.resize(cols, rows);
    }
  }

  private void ensureStopped(ManagedProcess p) {
    if (p.terminal != null)
      throw new WebApplicationException("Stop the process before editing or deleting", 409);
  }

  private ProcessSnapshot changed(ManagedProcess p) {
    var view = p.snapshot();
    logs.append("state", p.config.id(), p.runId, null, null, view, null);
    return view;
  }

  public void shutdown() {
    closing = true;
    var tasks =
        registry.all().stream()
            .map(p -> java.util.concurrent.CompletableFuture.runAsync(() -> stop(p.config.id())))
            .toList();
    for (var task : tasks)
      try {
        task.join();
      } catch (Exception e) {
        System.err.println("Shutdown: " + e.getMessage());
      }
    logs.flush();
  }
}
