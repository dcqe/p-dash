package com.example.dash.log;

import com.example.dash.config.LocalState;
import jakarta.annotation.*;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;
import java.util.regex.Pattern;

@ApplicationScoped
public class LogService {
  @Inject LocalState state;
  @Inject LogStream stream;
  private final LogBuffer buffer = new LogBuffer(12000, 2 * 1024 * 1024);
  private long sequence;
  private boolean dirty;
  private ScheduledExecutorService saver;
  private static final Pattern ANSI =
      Pattern.compile("\\x1B\\][^\\x07]*(?:\\x07|\\x1B\\\\)|\\x1B\\[[0-?]*[ -/]*[@-~]");

  public record Saved(long sequence, List<LogEntry> entries) {}

  @PostConstruct
  void load() {
    var saved = state.read("logs.json", Saved.class, new Saved(0, List.of()));
    sequence = saved.sequence();
    saved.entries().forEach(buffer::append);
    saver =
        Executors.newSingleThreadScheduledExecutor(
            r -> {
              var t = new Thread(r, "log-snapshot");
              t.setDaemon(true);
              return t;
            });
    saver.scheduleWithFixedDelay(
        () -> {
          try {
            flush();
          } catch (Exception e) {
            System.err.println("Could not save logs: " + e.getMessage());
          }
        },
        1,
        1,
        TimeUnit.SECONDS);
  }

  public synchronized long cursor() {
    return sequence;
  }

  public static String plain(String data) {
    return ANSI.matcher(data).replaceAll("").replaceAll("[\\x00-\\x08\\x0b-\\x1f\\x7f]", "");
  }

  public synchronized LogEntry append(
      String type,
      String id,
      String run,
      String data,
      String channel,
      Object process,
      Object workspaces) {
    var entry =
        new LogEntry(
            ++sequence,
            Instant.now().toString(),
            type,
            id,
            run,
            data,
            channel,
            process,
            workspaces);
    buffer.append(entry);
    dirty = true;
    stream.publish(entry);
    notifyAll();
    return entry;
  }

  public void output(String id, String run, String text, String channel) {
    for (int offset = 0; offset < text.length(); offset += 8192)
      append(
          "output",
          id,
          run,
          text.substring(offset, Math.min(offset + 8192, text.length())),
          channel,
          null,
          null);
  }

  public synchronized LogPage getLogs(Set<String> ids, long after, int limit, boolean plain) {
    if (after < 0 || limit < 1 || limit > 12000)
      throw new IllegalArgumentException("after >= 0 and limit 1-12000 required");
    var result =
        buffer.entries().stream()
            .filter(
                e ->
                    e.seq() > after
                        && (ids.isEmpty()
                            || (e.processId() != null && ids.contains(e.processId()))))
            .limit(limit)
            .map(
                e ->
                    plain && e.data() != null
                        ? new LogEntry(
                            e.seq(),
                            e.time(),
                            e.type(),
                            e.processId(),
                            e.runId(),
                            plain(e.data()),
                            e.stream(),
                            e.process(),
                            e.workspaces())
                        : e)
            .toList();
    return new LogPage(
        result,
        result.isEmpty() ? sequence : result.getLast().seq(),
        sequence,
        buffer.oldest(sequence),
        after > 0 && (after < buffer.oldest(sequence) - 1 || after > sequence));
  }

  /** Snapshot and subscription are atomic relative to appends: no replay/live gap. */
  public synchronized AutoCloseable subscribe(
      long after, Consumer<LogPage> initial, Consumer<LogEntry> next) {
    initial.accept(getLogs(Set.of(), after, 12000, false));
    return stream.subscribe(next);
  }

  public synchronized void awaitChange(long cursor, long millis) throws InterruptedException {
    if (sequence <= cursor) wait(Math.max(1, millis));
  }

  public synchronized void flush() {
    if (dirty) {
      state.write("logs.json", new Saved(sequence, buffer.entries()));
      dirty = false;
    }
  }

  @PreDestroy
  void close() {
    saver.shutdownNow();
    flush();
  }
}
