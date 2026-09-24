package com.example.dash;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.*;

import com.example.dash.demo.DemoProcessRunner;
import com.example.dash.log.*;
import com.example.dash.process.*;
import com.example.dash.security.LocalAccess;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.nio.file.Path;
import java.util.*;
import org.junit.jupiter.api.*;

@QuarkusTest
class DashboardTest {
  @Inject ProcessManager processes;
  @Inject LogService logs;
  @Inject LogWaitService waits;
  @Inject LocalAccess access;
  @io.quarkus.test.common.http.TestHTTPResource java.net.URI baseUri;
  final List<String> created = new ArrayList<>();

  ProcessConfig demo(String mode, String kind) throws Exception {
    String java =
        Path.of(
                System.getProperty("java.home"),
                "bin",
                System.getProperty("os.name").startsWith("Windows") ? "java.exe" : "java")
            .toString();
    String classes =
        Path.of(DemoProcessRunner.class.getProtectionDomain().getCodeSource().getLocation().toURI())
            .toString();
    var config =
        new ProcessConfig(
            null,
            "test " + kind,
            List.of(java, "-cp", classes, DemoProcessRunner.class.getName(), kind),
            Path.of("").toAbsolutePath().toString(),
            Map.of(),
            "#bcbcbc",
            "pty".equals(mode) ? "pty" : "pipe");
    created.add(config.id());
    processes.create(config);
    return config;
  }

  @Test void missingColorGetsStableVividAssignment() throws Exception {
    var first = new ProcessConfig("color-check", "Color check", List.of("cmd.exe", "/c", "exit", "0"), Path.of("").toAbsolutePath().toString(), Map.of(), null, "pipe");
    var second = new ProcessConfig("color-check", "Color check", first.command(), first.workingDirectory(), Map.of(), null, "pipe");
    assertEquals(first.color(), second.color());
    assertNotEquals("#bcbcbc", first.color());
    assertTrue(first.color().matches("#[0-9A-F]{6}"));
  }

  @AfterEach
  void cleanup() {
    for (String id : created) {
      processes.stop(id);
      processes.remove(id);
    }
  }

  ProcessConfig fixture(String kind) throws Exception {
    var original = demo("pipe", "HEALTHY");
    var config =
        new ProcessConfig(
            original.id(),
            "fixture",
            List.of(
                original.command().getFirst(),
                "-cp",
                Path.of(
                        ProcessFixture.class
                            .getProtectionDomain()
                            .getCodeSource()
                            .getLocation()
                            .toURI())
                    .toString(),
                ProcessFixture.class.getName(),
                kind),
            original.workingDirectory(),
            Map.of(),
            original.color(),
            "pipe");
    processes.update(config.id(), config);
    return config;
  }

  @Test
  void naturalExitDrainsStdoutAndStderr() throws Exception {
    var c = fixture("exit");
    long before = logs.cursor();
    processes.start(c.id());
    var result = waits.waitForExit(c.id(), 10000);
    assertTrue(result.exited());
    assertEquals(7, result.process().exitCode());
    assertEquals(ProcessStatus.FAILED, result.process().status());
    var output = logs.getLogs(Set.of(c.id()), before, 1000, true).events();
    assertTrue(
        output.stream()
            .anyMatch(e -> "stderr".equals(e.stream()) && e.data().contains("FIXTURE_STDERR")));
    assertTrue(
        output.stream()
            .anyMatch(e -> "stdout".equals(e.stream()) && e.data().contains("FIXTURE_DONE")));
  }

  @Test
  void stopAlsoTerminatesDescendants() throws Exception {
    var c = fixture("parent");
    long before = logs.cursor();
    processes.start(c.id());
    var result = waits.waitForRegex(c.id(), "CHILD_PID=\\d+", before, 10000);
    assertTrue(result.matched());
    var match = java.util.regex.Pattern.compile("CHILD_PID=(\\d+)").matcher(result.text());
    assertTrue(match.find());
    long child = Long.parseLong(match.group(1));
    try {
      processes.stop(c.id());
      assertFalse(ProcessHandle.of(child).map(ProcessHandle::isAlive).orElse(false));
    } finally {
      ProcessHandle.of(child)
          .filter(ProcessHandle::isAlive)
          .ifPresent(ProcessHandle::destroyForcibly);
    }
  }

  @Test
  void pipeLifecycleAndOutput() throws Exception {
    var c = demo("pipe", "HEALTHY");
    long before = logs.cursor();
    var started = processes.start(c.id());
    assertNotNull(started.pid());
    assertEquals(started.pid(), processes.start(c.id()).pid());
    assertTrue(waits.waitForReady(c.id(), "READY", before, 10000).matched());
    long cursor = logs.cursor();
    processes.input(c.id(), "hello-agent\n");
    assertTrue(waits.waitForRegex(c.id(), "INPUT.*hello-agent", cursor, 5000).matched());
    assertThrows(jakarta.ws.rs.WebApplicationException.class, () -> processes.remove(c.id()));
    assertEquals(ProcessStatus.STOPPED, processes.stop(c.id()).status());
    assertFalse(ProcessHandle.of(started.pid()).map(ProcessHandle::isAlive).orElse(false));
    var restarted = processes.start(c.id());
    assertNotEquals(started.runId(), restarted.runId());
    assertTrue(waits.waitForRegex(c.id(), "NEVER_MATCH", logs.cursor(), 30).timedOut());
  }

  @Test
  void realInteractivePty() throws Exception {
    var c = demo("pty", "HEALTHY");
    long before = logs.cursor();
    processes.start(c.id());
    assertTrue(waits.waitForReady(c.id(), "READY", before, 10000).matched());
    processes.resize(c.id(), 100, 25);
    long cursor = logs.cursor();
    processes.input(c.id(), "pty-input\r");
    assertTrue(waits.waitForRegex(c.id(), "INPUT.*pty-input", cursor, 5000).matched());
    assertTrue(
        logs.getLogs(Set.of(c.id()), before, 1000, false).events().stream()
            .anyMatch(e -> "terminal".equals(e.stream()) && e.data().contains("\u001b[")));
    processes.stop(c.id());
    assertTrue(waits.waitForExit(c.id(), 1000).exited());
  }

  @Test
  void filteredReplayAndSplitRegex() throws Exception {
    var c = demo("pipe", "HEALTHY");
    long cursor = logs.cursor();
    logs.append("groups", null, null, null, null, null, List.of());
    logs.output(c.id(), "run", "\u001b[32mREA", "stdout");
    logs.output(c.id(), "run", "DY\u001b[0m", "stdout");
    var found = waits.waitForRegex(c.id(), "READY", cursor, 0);
    assertTrue(found.matched());
    assertFalse(found.text().contains("\u001b"));
    assertEquals(2, logs.getLogs(Set.of(c.id()), cursor, 100, true).events().size());
    assertEquals(0, logs.getLogs(Set.of(c.id()), found.cursor(), 100, true).events().size());
  }

  @Test
  void localAuthenticationAndMcpDiscovery() {
    given().get("/api/status").then().statusCode(401);
    given().get("/api/session").then().statusCode(403);
    given()
        .header("Authorization", "Bearer " + access.token())
        .header("Origin", "https://example.org")
        .get("/api/status")
        .then()
        .statusCode(403);
    given()
        .header("Authorization", "Bearer " + access.token())
        .get("/api/status")
        .then()
        .statusCode(200);
    given()
        .contentType("application/json")
        .accept("application/json, text/event-stream")
        .header("Authorization", "Bearer " + access.token())
        .body(
            "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1\"}}}")
        .post("/mcp")
        .then()
        .statusCode(200)
        .body(org.hamcrest.Matchers.containsString("p-dash"));
  }

  @Test
  void mcpToolsControlTheSameProcesses() throws Exception {
    var c = demo("pipe", "HEALTHY");
    var response =
        given()
            .contentType("application/json")
            .accept("application/json, text/event-stream")
            .header("Authorization", "Bearer " + access.token())
            .body(
                "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-03-26\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1\"}}}")
            .post("/mcp")
            .then()
            .statusCode(200)
            .extract()
            .response();
    String session = response.header("Mcp-Session-Id");
    assertNotNull(session);
    var request =
        given()
            .contentType("application/json")
            .accept("application/json, text/event-stream")
            .header("Authorization", "Bearer " + access.token())
            .header("Mcp-Session-Id", session);
    request
        .body(Map.of("jsonrpc", "2.0", "id", 2, "method", "tools/list"))
        .post("/mcp")
        .then()
        .statusCode(200)
        .body(org.hamcrest.Matchers.containsString("wait_for_ready"));
    long cursor = logs.cursor();
    request
        .body(
            Map.of(
                "jsonrpc",
                "2.0",
                "id",
                3,
                "method",
                "tools/call",
                "params",
                Map.of("name", "start_process", "arguments", Map.of("processId", c.id()))))
        .post("/mcp")
        .then()
        .statusCode(200)
        .body(org.hamcrest.Matchers.containsString("running"));
    assertEquals(ProcessStatus.RUNNING, processes.status(c.id()).status());
    request
        .body(
            Map.of(
                "jsonrpc",
                "2.0",
                "id",
                4,
                "method",
                "tools/call",
                "params",
                Map.of(
                    "name",
                    "wait_for_ready",
                    "arguments",
                    Map.of(
                        "request",
                        Map.of(
                            "processId",
                            c.id(),
                            "regex",
                            "READY",
                            "afterCursor",
                            cursor,
                            "timeoutMs",
                            10000)))))
        .post("/mcp")
        .then()
        .statusCode(200)
        .body(org.hamcrest.Matchers.containsString("\"matched\":true"));
    request
        .body(
            Map.of(
                "jsonrpc",
                "2.0",
                "id",
                5,
                "method",
                "tools/call",
                "params",
                Map.of("name", "stop_process", "arguments", Map.of("processId", c.id()))))
        .post("/mcp")
        .then()
        .statusCode(200)
        .body(org.hamcrest.Matchers.containsString("stopped"));
  }

  @Test
  void websocketReplayThenLiveAndSingleUseTicket() throws Exception {
    var messages = new java.util.concurrent.LinkedBlockingQueue<String>();
    var listener =
        new java.net.http.WebSocket.Listener() {
          final StringBuilder text = new StringBuilder();

          public java.util.concurrent.CompletionStage<?> onText(
              java.net.http.WebSocket ws, CharSequence data, boolean last) {
            text.append(data);
            if (last) {
              messages.add(text.toString());
              text.setLength(0);
            }
            ws.request(1);
            return null;
          }
        };
    String ticket = access.ticket();
    var uri =
        java.net.URI.create(baseUri.toString().replace("http:", "ws:") + "terminal/" + ticket);
    var socket =
        java.net.http.HttpClient.newHttpClient()
            .newWebSocketBuilder()
            .buildAsync(uri, listener)
            .join();
    try {
      socket.sendText("{\"type\":\"subscribe\",\"after\":0}", true).join();
      String snapshot = messages.poll(5, java.util.concurrent.TimeUnit.SECONDS);
      assertNotNull(snapshot);
      assertTrue(snapshot.contains("\"type\":\"snapshot\""));
      logs.output("ws-test", "run", "LIVE_SENTINEL", "stdout");
      assertTrue(
          Objects.requireNonNull(messages.poll(5, java.util.concurrent.TimeUnit.SECONDS))
              .contains("LIVE_SENTINEL"));
      assertFalse(access.consume(ticket));
    } finally {
      socket.sendClose(1000, "done").join();
    }
  }
}
