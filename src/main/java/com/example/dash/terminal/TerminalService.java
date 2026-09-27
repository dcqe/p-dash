package com.example.dash.terminal;

import com.example.dash.log.LogService;
import com.example.dash.process.ProcessConfig;
import com.pty4j.PtyProcessBuilder;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@ApplicationScoped
public class TerminalService {
  @Inject LogService logs;

  public TerminalSession start(ProcessConfig config, String run) throws IOException {
    var env = new HashMap<>(System.getenv());
    env.put("TERM", "xterm-256color");
    env.put("COLORTERM", "truecolor");
    env.putAll(config.env());
    Process process;
    if (config.mode().equals("pty")) {
      process =
          new PtyProcessBuilder(config.command().toArray(String[]::new))
              .setDirectory(config.workingDirectory())
              .setEnvironment(env)
              .setUseWinConPty(true)
              .setWindowsAnsiColorEnabled(true)
              .setRedirectErrorStream(true)
              .setInitialColumns(120)
              .setInitialRows(30)
              .start();
    } else {
      var builder =
          new ProcessBuilder(config.command()).directory(new File(config.workingDirectory()));
      builder.environment().putAll(env);
      process = builder.start();
    }
    var stdout =
        read(
            process.getInputStream(),
            config.id(),
            run,
            config.mode().equals("pty") ? "terminal" : "stdout");
    var stderr =
        config.mode().equals("pty")
            ? CompletableFuture.<Void>completedFuture(null)
            : read(process.getErrorStream(), config.id(), run, "stderr");
    return new TerminalSession(process, CompletableFuture.allOf(stdout, stderr));
  }

  private CompletableFuture<Void> read(InputStream input, String id, String run, String channel) {
    var done = new CompletableFuture<Void>();
    Thread.ofVirtual()
        .name("output-" + id + "-" + channel)
        .start(
            () -> {
              try (var reader = new InputStreamReader(input, StandardCharsets.UTF_8)) {
                char[] buffer = new char[4096];
                int n;
                while ((n = reader.read(buffer)) != -1)
                  logs.output(id, run, new String(buffer, 0, n), channel);
              } catch (IOException ignored) {
                /* Closing a PTY during shutdown closes its read handle. */
              } finally {
                done.complete(null);
              }
            });
    return done;
  }

  public void stop(TerminalSession session) throws Exception {
    var process = session.process();
    var descendants =
        ProcessHandle.of(session.pid()).map(h -> h.descendants().toList()).orElse(List.of());
    if (session.alive()) {
      if (process instanceof com.pty4j.PtyProcess) {
        try {
          session.input("\u0003");
        } catch (IOException ignored) {
        }
      } else {
        // A Ctrl+C byte on a pipe is ordinary input, not an OS interrupt.
        process.destroy();
      }
      if (!process.waitFor(3, java.util.concurrent.TimeUnit.SECONDS)) {
        if (System.getProperty("os.name").startsWith("Windows")) {
          var killer =
              new ProcessBuilder("taskkill", "/PID", Long.toString(session.pid()), "/T", "/F")
                  .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                  .redirectError(ProcessBuilder.Redirect.DISCARD)
                  .start();
          killer.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
        }
        process.destroyForcibly();
      }
    }
    // Also cover children whose shell exited in response to Ctrl-C before escalation.
    descendants
        .reversed()
        .forEach(
            h -> {
              if (h.isAlive()) h.destroyForcibly();
            });
    if (!process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS))
      throw new IOException("Process did not terminate");
    // destroyForcibly requests termination; it does not wait for the OS to finish it.
    // Stop must not return while a captured descendant is still alive.
    var exits = descendants.stream().map(ProcessHandle::onExit).toArray(CompletableFuture[]::new);
    try {
      CompletableFuture.allOf(exits).get(5, java.util.concurrent.TimeUnit.SECONDS);
    } catch (java.util.concurrent.TimeoutException e) {
      throw new IOException("Process descendants did not terminate", e);
    }
  }
}
