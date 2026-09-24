package com.example.dash.process;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.Test;

class AccentMigrationTest {
  ProcessConfig command(String id, String color) {
    return new ProcessConfig(
        id,
        id,
        List.of("java", "-version"),
        Path.of("").toAbsolutePath().toString(),
        Map.of(),
        color,
        "pipe");
  }

  @Test
  void upgradesExistingGreyCommandsWithoutChangingTheirDefinitionsOrCustomColors() {
    var original =
        new ProcessConfig[] {
          command("demo-healthy", "#bcbcbc"),
          command("demo-flaky", "#bcbcbc"),
          command("demo-chatty", "#bcbcbc"),
          command("custom", "#ff6644")
        };
    var migrated = ProcessRegistry.migrateLegacyAccents(original);
    assertEquals(4, Arrays.stream(migrated).map(ProcessConfig::color).distinct().count());
    for (int i = 0; i < original.length; i++) {
      assertEquals(original[i].id(), migrated[i].id());
      assertEquals(original[i].command(), migrated[i].command());
      assertEquals(original[i].workingDirectory(), migrated[i].workingDirectory());
      assertEquals(original[i].env(), migrated[i].env());
    }
    assertEquals("#ff6644", migrated[3].color());
    assertArrayEquals(migrated, ProcessRegistry.migrateLegacyAccents(migrated));
  }
}
