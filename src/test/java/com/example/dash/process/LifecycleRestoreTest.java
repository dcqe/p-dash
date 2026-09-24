package com.example.dash.process;

import static org.junit.jupiter.api.Assertions.*;
import com.example.dash.config.LocalState;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.Test;

@QuarkusTest
class LifecycleRestoreTest {
  @Inject ProcessRegistry registry;
  @Inject LocalState state;
  @Inject ObjectMapper mapper;

  @Test void reloadDistinguishesNeverStartedStoppedAndInterruptedRuns() {
    var ids = new ArrayList<String>();
    try {
      for (var status : List.of(ProcessStatus.NOT_STARTED, ProcessStatus.STOPPED, ProcessStatus.RUNNING)) {
        var config = new ProcessConfig(null, "restore " + status, List.of("java", "-version"), Path.of("").toAbsolutePath().toString(), Map.of(), null, "pipe");
        ids.add(config.id()); registry.add(config);
        var managed = registry.get(config.id()); managed.status = status;
        if (status != ProcessStatus.NOT_STARTED) { managed.runId = "previous-run"; managed.startedAt = "2026-09-24T12:00:00Z"; }
        registry.recordLifecycle(managed.snapshot());
      }
      var restored = new ProcessRegistry(); restored.state = state; restored.mapper = mapper; restored.load();
      assertEquals(ProcessStatus.NOT_STARTED, restored.get(ids.get(0)).snapshot().status());
      assertEquals(ProcessStatus.STOPPED, restored.get(ids.get(1)).snapshot().status());
      var interrupted = restored.get(ids.get(2)).snapshot();
      assertEquals(ProcessStatus.FAILED, interrupted.status()); assertFalse(interrupted.alive()); assertNull(interrupted.pid());
      assertTrue(interrupted.error().contains("interrupted"));
    } finally { ids.forEach(registry::remove); }
  }

  @Test void quarkusDefaultsMatchStartupButNotMavenBuildOutput() {
    var readiness = ReadinessConfig.defaults(List.of("mvn", "quarkus:dev"));
    var pattern = com.google.re2j.Pattern.compile(readiness.value());
    assertFalse(pattern.matcher("[INFO] BUILD SUCCESS").find());
    assertTrue(pattern.matcher("orders 1.0 (powered by Quarkus) started in 2.4s. Listening on: http://localhost:8080").find());
  }
}
