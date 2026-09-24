package com.example.dash.terminal;

import com.pty4j.PtyProcess;
import com.pty4j.WinSize;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public final class TerminalSession {
  private final Process process;
  private final CompletableFuture<Void> drained;

  public TerminalSession(Process process, CompletableFuture<Void> drained) {
    this.process = process;
    this.drained = drained;
  }

  public long pid() {
    return process.pid();
  }

  public boolean alive() {
    return process.isAlive();
  }

  public Process process() {
    return process;
  }

  public synchronized void input(String data) throws IOException {
    process.getOutputStream().write(data.getBytes(StandardCharsets.UTF_8));
    process.getOutputStream().flush();
  }

  public void resize(int cols, int rows) {
    if (process instanceof PtyProcess pty && alive()) pty.setWinSize(new WinSize(cols, rows));
  }

  public int awaitExit() throws Exception {
    int code = process.waitFor();
    try {
      drained.get(3, TimeUnit.SECONDS);
    } catch (TimeoutException ignored) {
    }
    return code;
  }
}
