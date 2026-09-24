package com.example.dash.api;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import jakarta.ws.rs.ext.*;
import java.util.Map;

@Provider
public class ApiErrors implements ExceptionMapper<Exception> {
  public Response toResponse(Exception error) {
    int code =
        error instanceof WebApplicationException web
            ? web.getResponse().getStatus()
            : error instanceof IllegalArgumentException ? 400 : 500;
    return Response.status(code)
        .type(MediaType.APPLICATION_JSON)
        .entity(Map.of("error", error.getMessage() == null ? "Request failed" : error.getMessage()))
        .build();
  }
}
