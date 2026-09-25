package com.example.dash.api;

import com.example.dash.process.*;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

@Path("/api/workspaces")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class WorkspaceResource {
  @Inject WorkspaceService workspaces;

  @GET
  public List<Workspace> list() {
    return workspaces.list();
  }

  @POST
  public Workspace create(Workspace body) {
    return workspaces.save(null, body);
  }

  @PUT
  @Path("/{id}")
  public Workspace update(@PathParam("id") String id, Workspace body) {
    return workspaces.save(id, body);
  }

  @DELETE
  @Path("/{id}")
  public Map<String, Boolean> delete(@PathParam("id") String id) {
    workspaces.delete(id);
    return Map.of("ok", true);
  }
}
