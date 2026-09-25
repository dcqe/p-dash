package com.example.dash.process;

import com.example.dash.terminal.TerminalSession;
import java.util.ArrayList;

/** Each instance is its own lifecycle lock, so unrelated starts/stops can run concurrently. */
public final class ManagedProcess {
  public volatile ProcessConfig config;
  public volatile ProcessStatus status = ProcessStatus.NOT_STARTED;
  public volatile TerminalSession terminal;
  public String runId, startedAt, endedAt, error;
  public Integer exitCode;
  public Thread readinessWatcher;

  public ManagedProcess(ProcessConfig config) {
    this.config = config;
  }

  public synchronized ProcessSnapshot snapshot() {
    return new ProcessSnapshot(
        config.id(),
        config.name(),
        config.command(),
        config.workingDirectory(),
        config.color(),
        config.mode(),
        new ArrayList<>(config.env().keySet()),
        status,
        terminal != null && terminal.alive() ? terminal.pid() : null,
        runId,
        startedAt,
        endedAt,
        exitCode,
        error,
        terminal != null && terminal.alive(),
        config.readiness(),
        config.workspaceId());
  }
}
