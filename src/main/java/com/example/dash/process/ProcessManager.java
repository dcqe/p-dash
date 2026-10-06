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
  @Inject WorkspaceService workspaces;
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
    synchronized (workspaces) {
      workspaces.get(config.workspaceId());
      registry.add(config);
    }
    return changed(registry.get(config.id()));
  }

  public ProcessSnapshot update(String id, ProcessConfig config) {
    var p = registry.get(id);
    synchronized (p) {
      ensureRegistered(p);
      if (!id.equals(config.id())) throw new IllegalArgumentException("ID cannot change");
      if (!p.config.workspaceId().equals(config.workspaceId()))
        throw new IllegalArgumentException(
            "A command cannot move between workspaces; create a new definition instead");
      var previous = p.config;
      if (p.terminal != null
          && (!previous.command().equals(config.command())
              || !previous.workingDirectory().equals(config.workingDirectory())
              || !previous.env().equals(config.env())
              || !previous.mode().equals(config.mode())
              || !previous.readiness().equals(config.readiness())))
        throw new WebApplicationException(
            "Only name and color can change while the process is active; stop it to edit launch settings", 409);
      p.config = config;
      registry.save();
      return changed(p);
    }
  }

  public void remove(String id) {
    var p = registry.get(id);
    synchronized (p) {
      ensureRegistered(p);
      ensureStopped(p);
      registry.remove(id);
      logs.append("removed", id, null, null, null, null, null);
    }
  }

  public ProcessSnapshot start(String id) {
    var p = registry.get(id);
    synchronized (p) {
      ensureRegistered(p);
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
        long outputCursor = logs.cursor();
        var session = terminals.start(p.config, p.runId);
        p.terminal = session;
        if (p.config.readiness().mode().equals("process")) p.status = ProcessStatus.RUNNING;
        changed(p);
        if (p.status == ProcessStatus.STARTING)
          p.readinessWatcher =
              Thread.ofVirtual()
                  .name("readiness-" + id)
                  .start(() -> monitorReadiness(p, session, outputCursor));
        Thread.ofVirtual()
            .name("exit-" + id)
            .start(
                () -> {
                  try {
                    int code = session.awaitExit();
                    synchronized (p) {
                      if (p.terminal != session) return;
                      cancelReadiness(p);
                      p.exitCode = code;
                      p.endedAt = Instant.now().toString();
                      p.terminal = null;
                      p.status = code == 0 ? ProcessStatus.EXITED : ProcessStatus.FAILED;
                      p.error =
                          code == 0 ? null : "Process exited unexpectedly (exit code " + code + ")";
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
      cancelReadiness(p);
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

  private void ensureRegistered(ManagedProcess p) {
    if (p.removing)
      throw new WebApplicationException("The workspace is being deleted", 409);
    if (registry.get(p.config.id()) != p)
      throw new jakarta.ws.rs.NotFoundException("Process definition was removed");
  }

  private ProcessSnapshot changed(ManagedProcess p) {
    var view = p.snapshot();
    registry.recordLifecycle(view);
    logs.append("state", p.config.id(), p.runId, null, null, view, null);
    return view;
  }

  private void cancelReadiness(ManagedProcess p) {
    if (p.readinessWatcher != null && p.readinessWatcher != Thread.currentThread())
      p.readinessWatcher.interrupt();
    p.readinessWatcher = null;
  }

  private final java.net.http.HttpClient healthClient =
      java.net.http.HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(2)).build();

  private void monitorReadiness(ManagedProcess p, TerminalSession session, long cursor) {
    var check = p.config.readiness();
    var pattern =
        check.mode().equals("log") ? com.google.re2j.Pattern.compile(check.value()) : null;
    var text = new StringBuilder();
    long deadline = System.nanoTime() + check.timeoutMs() * 1_000_000L;
    try {
      while (!Thread.currentThread().isInterrupted()) {
        synchronized (p) {
          if (p.terminal != session || p.status != ProcessStatus.STARTING || !session.alive())
            return;
        }
        boolean ready = false;
        if (pattern != null) {
          var page = logs.getLogs(Set.of(p.config.id()), cursor, 12000, false);
          cursor = page.cursor();
          for (var entry : page.events()) {
            if (entry.data() == null || !Objects.equals(entry.runId(), p.runId)) continue;
            text.append(entry.data());
            if (text.length() > 65536) text.delete(0, text.length() - 65536);
            if (pattern.matcher(LogService.plain(text.toString())).find()) {
              ready = true;
              break;
            }
          }
        } else {
          try {
            var request =
                java.net.http.HttpRequest.newBuilder(java.net.URI.create(check.value()))
                    .timeout(java.time.Duration.ofSeconds(2))
                    .GET()
                    .build();
            int code =
                healthClient
                    .send(request, java.net.http.HttpResponse.BodyHandlers.discarding())
                    .statusCode();
            ready = code >= 200 && code < 300;
          } catch (java.io.IOException ignored) {
            /* Refused connections are normal during startup. */
          }
        }
        synchronized (p) {
          if (p.terminal != session || p.status != ProcessStatus.STARTING || !session.alive())
            return;
          if (ready) {
            p.status = ProcessStatus.RUNNING;
            p.readinessWatcher = null;
            changed(p);
            return;
          }
          if (System.nanoTime() >= deadline) {
            // Publish STOPPING while terminating a startup that never became ready.
            p.status = ProcessStatus.STOPPING;
            changed(p);
            terminals.stop(session);
            p.exitCode = session.awaitExit();
            p.terminal = null;
            p.status = ProcessStatus.FAILED;
            p.endedAt = Instant.now().toString();
            p.error = "Readiness check timed out after " + check.timeoutMs() + " ms";
            p.readinessWatcher = null;
            changed(p);
            return;
          }
        }
        Thread.sleep(200);
      }
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      synchronized (p) {
        if (p.terminal == session && p.status != ProcessStatus.STOPPED) {
          p.status = ProcessStatus.FAILED;
          p.error = "Readiness check failed: " + e.getMessage();
          changed(p);
        }
      }
    }
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
