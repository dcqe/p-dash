package com.example.dash.api;

import com.example.dash.log.LogService;
import com.example.dash.process.*;
import com.example.dash.security.LocalAccess;
import io.quarkus.runtime.Quarkus;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

@Path("/api")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProcessResource {
  @Inject ProcessManager manager;
  @Inject WorkspaceService workspaces;
  @Inject LogService logs;
  @Inject LocalAccess access;

  @GET
  @Path("/session")
  public Map<String, String> session() {
    return Map.of("token", access.token());
  }

  @POST
  @Path("/terminal-ticket")
  public Map<String, String> ticket() {
    return Map.of("ticket", access.ticket());
  }

  @GET
  @Path("/status")
  public Map<String, Object> status() {
    return Map.of(
        "name",
        "p-dash",
        "version",
        "2.0.0",
        "cwd",
        java.nio.file.Path.of("").toAbsolutePath().normalize().toString(),
        "pid",
        ProcessHandle.current().pid(),
        "platform",
        System.getProperty("os.name"),
        "cursor",
        logs.cursor(),
        "commands",
        manager.list(),
        "workspaces",
        workspaces.list());
  }

  @GET
  @Path("/commands")
  public List<ProcessSnapshot> list() {
    return manager.list();
  }

  public record Definition(
      String name,
      List<String> command,
      String cwd,
      String workingDirectory,
      Map<String, String> env,
      String color,
      String mode,
      ReadinessConfig readiness,
      String workspaceId) {
    ProcessConfig config(String id, ProcessConfig previous) {
      return new ProcessConfig(
          id,
          name != null ? name : previous.name(),
          command != null ? command : previous.command(),
          workingDirectory != null
              ? workingDirectory
              : cwd != null ? cwd : previous.workingDirectory(),
          env != null ? env : previous == null ? null : previous.env(),
          color != null ? color : previous == null ? null : previous.color(),
          mode != null ? mode : previous == null ? null : previous.mode(),
          readiness != null ? readiness : previous == null ? null : previous.readiness(),
          workspaceId != null
              ? workspaceId
              : previous == null ? "default" : previous.workspaceId());
    }
  }

  @POST
  @Path("/commands")
  public ProcessSnapshot create(Definition body) {
    if (body == null
        || body.name() == null
        || body.command() == null
        || (body.cwd() == null && body.workingDirectory() == null))
      throw new IllegalArgumentException("name, command array, and workingDirectory required");
    return manager.create(body.config(null, null));
  }

  @PATCH
  @Path("/commands/{id}")
  public ProcessSnapshot edit(@PathParam("id") String id, Definition body) {
    return manager.update(id, body.config(id, manager.definition(id)));
  }

  @DELETE
  @Path("/commands/{id}")
  public Map<String, Boolean> delete(@PathParam("id") String id) {
    manager.remove(id);
    return Map.of("ok", true);
  }

  @POST
  @Path("/commands/{id}/{action:start|stop|restart}")
  public ProcessSnapshot control(@PathParam("id") String id, @PathParam("action") String action) {
    return switch (action) {
      case "start" -> manager.start(id);
      case "stop" -> manager.stop(id);
      default -> manager.restart(id);
    };
  }

  public record Input(String data) {}

  public record Size(int cols, int rows) {}

  @POST
  @Path("/commands/{id}/input")
  public Map<String, Boolean> input(@PathParam("id") String id, Input body) {
    manager.input(id, body.data());
    return Map.of("ok", true);
  }

  @POST
  @Path("/commands/{id}/resize")
  public Map<String, Boolean> resize(@PathParam("id") String id, Size body) {
    manager.resize(id, body.cols(), body.rows());
    return Map.of("ok", true);
  }

  @POST
  @Path("/shutdown")
  public Map<String, Boolean> shutdown() {
    Thread.ofVirtual()
        .start(
            () -> {
              try {
                Thread.sleep(200);
              } catch (InterruptedException ignored) {
              }
              Quarkus.asyncExit();
            });
    return Map.of("ok", true);
  }
}
