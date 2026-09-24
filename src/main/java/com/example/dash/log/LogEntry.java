package com.example.dash.log;

public record LogEntry(
    long seq,
    String time,
    String type,
    String processId,
    String runId,
    String data,
    String stream,
    Object process,
    Object groups) {}
