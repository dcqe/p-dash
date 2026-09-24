package com.example.dash.log;

import java.util.List;

public record LogPage(
    List<LogEntry> events, long cursor, long latest, long oldest, boolean truncated) {}
