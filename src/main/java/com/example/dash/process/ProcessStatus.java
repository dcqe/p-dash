package com.example.dash.process;

import com.fasterxml.jackson.annotation.JsonValue;

public enum ProcessStatus {
  NOT_STARTED,
  STARTING,
  RUNNING,
  STOPPING,
  STOPPED,
  EXITED,
  FAILED;

  @JsonValue
  public String json() {
    return name().toLowerCase();
  }
}
