package com.example.dash.log;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

@ApplicationScoped
public class LogStream {
  private final CopyOnWriteArrayList<Consumer<LogEntry>> listeners = new CopyOnWriteArrayList<>();

  public AutoCloseable subscribe(Consumer<LogEntry> listener) {
    listeners.add(listener);
    return () -> listeners.remove(listener);
  }

  public void publish(LogEntry entry) {
    for (var listener : listeners)
      try {
        listener.accept(entry);
      } catch (RuntimeException e) {
        listeners.remove(listener);
      }
  }
}
