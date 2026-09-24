package com.example.dash.api;

import com.example.dash.log.*;
import com.example.dash.mcp.dto.WaitForLogRequest;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.*;

@Path("/api/logs")
@Produces(MediaType.APPLICATION_JSON)
public class LogResource {
  @Inject LogService logs;
  @Inject LogWaitService waits;

  @GET
  public LogPage get(
      @QueryParam("ids") String ids,
      @QueryParam("after") @DefaultValue("0") long after,
      @QueryParam("limit") @DefaultValue("2000") int limit,
      @QueryParam("plain") @DefaultValue("false") boolean plain) {
    return logs.getLogs(
        ids == null || ids.isBlank() ? Set.of() : new HashSet<>(Arrays.asList(ids.split(","))),
        after,
        limit,
        plain);
  }

  @GET
  @Path("/search")
  public Object search(
      @QueryParam("id") String id,
      @QueryParam("regex") String regex,
      @QueryParam("after") @DefaultValue("0") long after,
      @QueryParam("limit") @DefaultValue("100") int limit) {
    return waits.search(id, regex, after, limit);
  }

  @POST
  @Path("/wait")
  @Consumes(MediaType.APPLICATION_JSON)
  public Object waitFor(WaitForLogRequest request) throws InterruptedException {
    return waits.waitForRegex(
        request.processId(), request.regex(), request.afterCursor(), request.timeoutMs());
  }
}
