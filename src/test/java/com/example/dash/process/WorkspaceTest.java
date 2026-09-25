package com.example.dash.process;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.*;

import com.example.dash.config.LocalState;
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
      assertThrows(jakarta.ws.rs.WebApplicationException.class, () -> workspaces.delete(w.id()));
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
          .statusCode(409);
      given().header("Authorization", token).get("/api/groups").then().statusCode(404);
    } finally {
      if (pid != null) processes.remove(pid);
      workspaces.delete(wid);
    }
  }
}
