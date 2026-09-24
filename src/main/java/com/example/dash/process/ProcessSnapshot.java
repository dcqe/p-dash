package com.example.dash.process;

import java.util.List;

/** Public state deliberately excludes environment values. */
public record ProcessSnapshot(
    String id,
    String name,
    List<String> command,
    String cwd,
    String color,
    String mode,
    List<String> envKeys,
    ProcessStatus status,
    Long pid,
    String runId,
    String startedAt,
    String endedAt,
    Integer exitCode,
    String error,
    boolean alive,
    ReadinessConfig readiness) {}
