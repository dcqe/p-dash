package com.example.dash.log;

import java.util.*;

/** Bounded ring of immutable records. Caller holds LogService's lock. */
public final class LogBuffer {
  private final ArrayDeque<LogEntry> entries = new ArrayDeque<>();
  private final int maxEntries, maxCharacters;
  private int characters;

  public LogBuffer(int maxEntries, int maxCharacters) {
    this.maxEntries = maxEntries;
    this.maxCharacters = maxCharacters;
  }

  public void append(LogEntry entry) {
    entries.addLast(entry);
    characters += size(entry);
    while (entries.size() > maxEntries || characters > maxCharacters)
      characters -= size(entries.removeFirst());
  }

  private int size(LogEntry entry) {
    return (entry.data() == null ? 0 : entry.data().length()) + 512;
  }

  public List<LogEntry> entries() {
    return List.copyOf(entries);
  }

  public long oldest(long latest) {
    return entries.isEmpty() ? latest + 1 : entries.getFirst().seq();
  }
}
