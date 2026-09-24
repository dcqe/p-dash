package com.example.dash.process;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ProcessStatus {
  STOPPED,
  STARTING,
  RUNNING,
  STOPPING,
  EXITED,
  FAILED;

  @JsonValue
  public String json() {
    return name().toLowerCase();
  }
}
