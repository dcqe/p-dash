package com.example.dash.process;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.*;

import com.example.dash.config.LocalState;
import com.example.dash.ProcessFixture;
import com.example.dash.log.LogService;
import com.example.dash.security.LocalAccess;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.Test;

@QuarkusTest
class WorkspaceTest {
  @Inject WorkspaceService workspaces;
  @Inject ProcessManager processes;
  @Inject LocalState state;
  @Inject LocalAccess access;
  @Inject ObjectMapper mapper;
  @Inject LogService logs;

  @Test
  void definitionsRemainIsolatedAndWorkspaceSettingsPersist() throws Exception {
    var w = workspaces.save(null, new Workspace(null, "Separate project", "Test", "#5B8FF9", null));
    String id = UUID.randomUUID().toString();
    try {
      var config =
          new ProcessConfig(
              id,
              "Saved command",
              List.of("java", "-version"),
              w.workingDirectory(),
              Map.of(),
              null,
              "pipe",
              null,
              w.id());
      var snapshot = processes.create(config);
      assertEquals(w.id(), snapshot.workspaceId());
      assertEquals(ProcessStatus.NOT_STARTED, snapshot.status());
      assertFalse(snapshot.alive());
      assertThrows(
          IllegalArgumentException.class,
          () ->
              processes.update(
                  id,
                  new ProcessConfig(
                      id,
                      config.name(),
                      config.command(),
                      config.workingDirectory(),
                      Map.of(),
                      null,
                      "pipe")));
      var updated =
          workspaces.save(
              w.id(), new Workspace(null, "Renamed", "Updated", "#61DDAA", w.workingDirectory()));
      assertEquals("Renamed", updated.name());
      assertTrue(
          Arrays.stream(state.readConfig("workspaces", Workspace[].class))
              .anyMatch(saved -> saved.id().equals(w.id()) && saved.name().equals("Renamed")));
      var stored =
          Arrays.stream(state.readConfig("commands", ProcessConfig[].class))
              .filter(c -> c.id().equals(id))
              .findFirst()
              .orElseThrow();
      assertEquals(w.id(), stored.workspaceId());
      assertEquals(w.id(), processes.status(id).workspaceId());
    } finally {
      processes.remove(id);
      workspaces.delete(w.id());
    }
    assertThrows(jakarta.ws.rs.WebApplicationException.class, () -> workspaces.delete("default"));
    var legacy =
        new ProcessConfig(
            null,
            "Legacy",
            List.of("java", "-version"),
            Path.of("").toAbsolutePath().toString(),
            Map.of(),
            null,
            "pipe");
    var json = mapper.valueToTree(legacy);
    ((com.fasterxml.jackson.databind.node.ObjectNode) json).remove("workspaceId");
    assertEquals("default", mapper.treeToValue(json, ProcessConfig.class).workspaceId());
    assertThrows(
        jakarta.ws.rs.NotFoundException.class,
        () ->
            processes.create(
                new ProcessConfig(
                    null,
                    "Missing workspace",
                    legacy.command(),
                    legacy.workingDirectory(),
                    Map.of(),
                    null,
                    "pipe",
                    null,
                    "missing-workspace")));
  }

  @Test
  void restCreatesWorkspaceAndCommandWithoutStartingIt() {
    String token = "Bearer " + access.token();
    String wid =
        given()
            .header("Authorization", token)
            .contentType("application/json")
            .body(Map.of("name", "REST workspace"))
            .post("/api/workspaces")
            .then()
            .statusCode(200)
            .extract()
            .path("id");
    String pid = null;
    try {
      pid =
          given()
              .header("Authorization", token)
              .contentType("application/json")
              .body(
                  Map.of(
                      "name",
                      "REST command",
                      "command",
                      List.of("java", "-version"),
                      "cwd",
                      Path.of("").toAbsolutePath().toString(),
                      "workspaceId",
                      wid))
              .post("/api/commands")
              .then()
              .statusCode(200)
              .body("workspaceId", org.hamcrest.Matchers.equalTo(wid))
              .body("alive", org.hamcrest.Matchers.equalTo(false))
              .extract()
              .path("id");
      given()
          .header("Authorization", token)
          .contentType("application/json")
          .body(Map.of("name", "Edited"))
          .patch("/api/commands/" + pid)
          .then()
          .statusCode(200)
          .body("workspaceId", org.hamcrest.Matchers.equalTo(wid));
      given()
          .header("Authorization", token)
          .delete("/api/workspaces/" + wid)
          .then()
          .statusCode(200);
      assertThrows(jakarta.ws.rs.NotFoundException.class, () -> workspaces.get(wid));
      assertTrue(processes.list().stream().noneMatch(p -> p.workspaceId().equals(wid)));
      pid = null;
      given().header("Authorization", token).get("/api/groups").then().statusCode(404);
    } finally {
      if (pid != null) processes.remove(pid);
      if (workspaces.list().stream().anyMatch(w -> w.id().equals(wid))) workspaces.delete(wid);
    }
  }

  @Test
  void workspaceDeletionRejectsActiveCommandsAndRemovesAllStoppedDefinitions() throws Exception {
    var w = workspaces.save(null, new Workspace(null, "Delete project", "", null, null));
    String javaExecutable = Path.of(System.getProperty("java.home"), "bin",
        System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java").toString();
    String classes = Path.of(ProcessFixture.class.getProtectionDomain().getCodeSource().getLocation().toURI()).toString();
    var stopped = new ProcessConfig(null, "Never started", List.of(javaExecutable, "-version"),
        w.workingDirectory(), Map.of(), null, "pipe", null, w.id());
    var running = new ProcessConfig(null, "Active", List.of(javaExecutable, "-cp", classes,
        ProcessFixture.class.getName(), "ready-on-input"), w.workingDirectory(), Map.of(), null,
        "pipe", new ReadinessConfig("log", "READY", 120000), w.id());
    var other = new ProcessConfig(null, "Other workspace", List.of(javaExecutable, "-version"),
        w.workingDirectory(), Map.of(), null, "pipe");
    processes.create(stopped);
    processes.create(running);
    processes.create(other);
    try {
      var start = processes.start(running.id());
      assertEquals(ProcessStatus.STARTING, start.status());
      assertDeletionBlocked(w.id());
      // A rejected deletion must release its reservation on the stopped definition.
      processes.update(stopped.id(), stopped);
      processes.input(running.id(), "ready\n");
      long deadline = System.nanoTime() + 10_000_000_000L;
      while (processes.status(running.id()).status() != ProcessStatus.RUNNING
          && System.nanoTime() < deadline) Thread.sleep(25);
      assertEquals(ProcessStatus.RUNNING, processes.status(running.id()).status());
      assertDeletionBlocked(w.id());
      assertEquals(start.pid(), processes.status(running.id()).pid());
      assertEquals(start.runId(), processes.status(running.id()).runId());
      assertEquals(stopped, processes.definition(stopped.id()));
      assertEquals(running, processes.definition(running.id()));
      processes.stop(running.id());
      long cursor = logs.cursor();
      workspaces.delete(w.id());
      assertThrows(jakarta.ws.rs.NotFoundException.class, () -> processes.start(stopped.id()));
      assertThrows(jakarta.ws.rs.NotFoundException.class, () -> processes.status(running.id()));
      assertThrows(jakarta.ws.rs.NotFoundException.class, () -> workspaces.get(w.id()));
      assertEquals(other, processes.definition(other.id()));
      assertTrue(Arrays.stream(state.readConfig("commands", ProcessConfig[].class))
          .noneMatch(c -> c.workspaceId().equals(w.id())));
      assertTrue(Arrays.stream(state.readConfig("workspaces", Workspace[].class))
          .noneMatch(saved -> saved.id().equals(w.id())));
      assertTrue(Arrays.stream(state.read("runtime/lifecycle.json", ProcessSnapshot[].class, new ProcessSnapshot[0]))
          .noneMatch(saved -> saved.workspaceId().equals(w.id())));
      var events = logs.getLogs(Set.of(), cursor, 1000, false).events();
      assertEquals(Set.of(stopped.id(), running.id()), events.stream()
          .filter(e -> e.type().equals("removed")).map(e -> e.processId()).collect(java.util.stream.Collectors.toSet()));
      assertTrue(events.stream().anyMatch(e -> e.type().equals("workspaces")));
    } finally {
      for (var config : List.of(stopped, running, other)) {
        if (processes.list().stream().anyMatch(p -> p.id().equals(config.id()))) {
          processes.stop(config.id());
          processes.remove(config.id());
        }
      }
      if (workspaces.list().stream().anyMatch(saved -> saved.id().equals(w.id()))) workspaces.delete(w.id());
    }
  }

  private void assertDeletionBlocked(String workspaceId) {
    var error = assertThrows(jakarta.ws.rs.WebApplicationException.class, () -> workspaces.delete(workspaceId));
    assertEquals(409, error.getResponse().getStatus());
    assertNotNull(workspaces.get(workspaceId));
  }
}
