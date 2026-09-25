package com.example.dash.terminal;

import com.example.dash.log.*;
import com.example.dash.process.*;
import com.example.dash.security.LocalAccess;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.websocket.*;
import jakarta.websocket.server.*;
import java.util.*;
import java.util.concurrent.*;

@ServerEndpoint("/terminal/{ticket}")
@ApplicationScoped
public class TerminalWebSocket {
  @Inject LocalAccess access;
  @Inject LogService logs;
  @Inject ProcessManager manager;
  @Inject WorkspaceService workspaces;
  @Inject ObjectMapper mapper;
  private final Map<String, Client> clients = new ConcurrentHashMap<>();

  @OnOpen
  public void open(Session session, @PathParam("ticket") String ticket) throws Exception {
    if (!access.consume(ticket)) {
      session.close(
          new CloseReason(CloseReason.CloseCodes.VIOLATED_POLICY, "Invalid or expired ticket"));
      return;
    }
    session.setMaxIdleTimeout(120000);
    session.getAsyncRemote().setSendTimeout(10000);
    clients.put(session.getId(), new Client(session));
  }

  @OnMessage
  public void message(Session session, String text) throws Exception {
    var client = clients.get(session.getId());
    if (client == null) return;
    var body = mapper.readTree(text);
    if (body.path("type").asText().equals("ping")) {
      client.send(Map.of("type", "pong"));
      return;
    }
    if (!body.path("type").asText().equals("subscribe") || client.subscription != null) return;
    long stateCursor = logs.cursor();
    var commands = manager.list();
    var workspaceList = workspaces.list();
    client.subscription =
        logs.subscribe(
            body.path("after").asLong(0),
            page ->
                client.send(
                    Map.of(
                        "type",
                        "snapshot",
                        "seq",
                        page.latest(),
                        "stateCursor",
                        stateCursor,
                        "cursor",
                        page.cursor(),
                        "events",
                        page.events(),
                        "truncated",
                        page.truncated(),
                        "commands",
                        commands,
                        "workspaces",
                        workspaceList)),
            client::send);
  }

  @OnClose
  public void close(Session session) {
    var client = clients.remove(session.getId());
    if (client != null) client.dispose();
  }

  @OnError
  public void error(Session session, Throwable error) {
    close(session);
    try {
      session.close();
    } catch (Exception ignored) {
    }
  }

  private class Client {
    final Session session;
    final ArrayDeque<String> queue = new ArrayDeque<>();
    AutoCloseable subscription;
    boolean sending;
    int size;

    Client(Session session) {
      this.session = session;
    }

    synchronized void send(Object value) {
      try {
        var text = mapper.writeValueAsString(value);
        size += text.length();
        if (size > 4 * 1024 * 1024) {
          session.close(
              new CloseReason(CloseReason.CloseCodes.TRY_AGAIN_LATER, "Consumer too slow"));
          return;
        }
        queue.addLast(text);
        drain();
      } catch (Exception e) {
        dispose();
      }
    }

    synchronized void drain() {
      if (sending || queue.isEmpty() || !session.isOpen()) return;
      sending = true;
      var text = queue.peekFirst();
      session
          .getAsyncRemote()
          .sendText(
              text,
              result -> {
                synchronized (this) {
                  if (!queue.isEmpty()) {
                    size -= queue.removeFirst().length();
                  }
                  sending = false;
                  if (result.isOK()) drain();
                  else dispose();
                }
              });
    }

    synchronized void dispose() {
      if (subscription != null)
        try {
          subscription.close();
        } catch (Exception ignored) {
        }
      queue.clear();
      size = 0;
    }
  }
}
