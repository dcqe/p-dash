package com.example.dash.security;

import io.quarkus.vertx.web.RouteFilter;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

@ApplicationScoped
public class LocalRequestFilter {
  @Inject LocalAccess access;

  @RouteFilter(1000)
  void filter(RoutingContext ctx) {
    var req = ctx.request();
    String host = req.getHeader("Host");
    int port = req.localAddress().port();
    var hosts = Set.of("127.0.0.1:" + port, "localhost:" + port);
    ctx.response()
        .putHeader("X-Content-Type-Options", "nosniff")
        .putHeader("Referrer-Policy", "no-referrer")
        .putHeader("X-Frame-Options", "DENY");
    if (!hosts.contains(host)) {
      deny(ctx, 403, "Invalid Host");
      return;
    }
    String origin = req.getHeader("Origin");
    if (origin != null && !hosts.stream().anyMatch(h -> origin.equals("http://" + h))) {
      deny(ctx, 403, "Invalid Origin");
      return;
    }
    String path = ctx.normalizedPath();
    if (path.equals("/api/session")) {
      if (!"same-origin".equals(req.getHeader("Sec-Fetch-Site"))) {
        deny(ctx, 403, "Browser session requires same-origin fetch");
        return;
      }
    } else if (path.startsWith("/api/") || path.equals("/mcp") || path.startsWith("/mcp/")) {
      if (!access.accepts(req.getHeader("Authorization"))) {
        deny(ctx, 401, "Valid bearer token required");
        return;
      }
    }
    if (path.startsWith("/api/")) ctx.response().putHeader("Cache-Control", "no-store");
    ctx.next();
  }

  private void deny(RoutingContext ctx, int status, String message) {
    ctx.response()
        .setStatusCode(status)
        .putHeader("Content-Type", "application/json")
        .end(new io.vertx.core.json.JsonObject().put("error", message).encode());
  }
}
