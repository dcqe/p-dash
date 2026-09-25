package com.example.dash.log;

@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public record LogEntry(
    long seq,
    String time,
    String type,
    String processId,
    String runId,
    String data,
    String stream,
    Object process,
    Object workspaces) {}
