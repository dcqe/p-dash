package com.example.dash.log;

import com.example.dash.process.*;
import com.google.re2j.Pattern;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.*;

@ApplicationScoped
public class LogWaitService {
  @Inject LogService logs;
  @Inject ProcessManager processes;

  public record Result(
      boolean matched,
      boolean timedOut,
      boolean exited,
      boolean truncated,
      long cursor,
      String text,
      ProcessSnapshot process) {}

  public Result waitForRegex(String id, String regex, long after, int timeoutMs)
      throws InterruptedException {
    processes.status(id);
    validate(timeoutMs);
    if (regex == null || regex.isEmpty() || regex.length() > 1000)
      throw new IllegalArgumentException("Regex must be 1-1000 characters");
    var pattern = Pattern.compile(regex);
    long end = System.nanoTime() + timeoutMs * 1_000_000L;
    long cursor = after;
    boolean truncated = false;
    StringBuilder collected = new StringBuilder();
    String run = null;
    while (true) {
      var page = logs.getLogs(Set.of(id), cursor, 12000, false);
      truncated |= page.truncated();
      cursor = page.cursor();
      for (var e : page.events())
        if (e.data() != null) {
          if (!Objects.equals(run, e.runId())) {
            run = e.runId();
            collected.setLength(0);
          }
          collected.append(e.data());
          if (collected.length() > 65536) collected.delete(0, collected.length() - 65536);
          var text = LogService.plain(collected.toString());
          if (pattern.matcher(text).find())
            return new Result(true, false, false, truncated, e.seq(), text, processes.status(id));
        }
      var status = processes.status(id);
      boolean exited =
          status.status() == ProcessStatus.EXITED
              || status.status() == ProcessStatus.FAILED
              || status.status() == ProcessStatus.STOPPED;
      if (exited) return new Result(false, false, true, truncated, cursor, null, status);
      long left = (end - System.nanoTime()) / 1_000_000;
      if (left <= 0) return new Result(false, true, false, truncated, cursor, null, status);
      logs.awaitChange(cursor, Math.min(left, 250));
    }
  }

  public Result waitForReady(String id, String regex, long after, int timeoutMs)
      throws InterruptedException {
    return waitForRegex(id, regex, after, timeoutMs);
  }

  public Result waitForExit(String id, int timeoutMs) throws InterruptedException {
    validate(timeoutMs);
    long end = System.nanoTime() + timeoutMs * 1_000_000L;
    while (true) {
      var s = processes.status(id);
      if (s.status() == ProcessStatus.STOPPED
          || s.status() == ProcessStatus.EXITED
          || s.status() == ProcessStatus.FAILED)
        return new Result(true, false, true, false, logs.cursor(), null, s);
      long left = (end - System.nanoTime()) / 1_000_000;
      if (left <= 0) return new Result(false, true, false, false, logs.cursor(), null, s);
      logs.awaitChange(logs.cursor(), Math.min(left, 250));
    }
  }

  private void validate(int timeout) {
    if (timeout < 0 || timeout > 30000)
      throw new IllegalArgumentException("timeoutMs must be 0-30000");
  }

  public List<LogEntry> search(String id, String regex, long after, int limit) {
    if (regex == null || regex.isEmpty() || regex.length() > 1000)
      throw new IllegalArgumentException("Regex must be 1-1000 characters");
    if (limit < 1 || limit > 12000) throw new IllegalArgumentException("limit must be 1-12000");
    var pattern = Pattern.compile(regex);
    return logs.getLogs(id == null ? Set.of() : Set.of(id), after, 12000, true).events().stream()
        .filter(e -> e.data() != null && pattern.matcher(e.data()).find())
        .limit(Math.min(limit, 12000))
        .toList();
  }
}
