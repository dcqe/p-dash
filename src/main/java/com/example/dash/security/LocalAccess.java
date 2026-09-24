package com.example.dash.security;

import com.example.dash.config.LocalState;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class LocalAccess {
  @Inject LocalState state;
  private String token;
  private final Map<String, Long> tickets = new ConcurrentHashMap<>();

  @PostConstruct
  void init() {
    try {
      var path = state.file("token");
      if (Files.exists(path)) token = Files.readString(path).trim();
      else {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        token = HexFormat.of().formatHex(bytes);
        Files.writeString(path, token, StandardOpenOption.CREATE_NEW);
        LocalState.restrict(path);
      }
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public String token() {
    return token;
  }

  public boolean accepts(String authorization) {
    return authorization != null
        && MessageDigest.isEqual(
            ("Bearer " + token).getBytes(StandardCharsets.UTF_8),
            authorization.getBytes(StandardCharsets.UTF_8));
  }

  public String ticket() {
    tickets.entrySet().removeIf(e -> e.getValue() < System.currentTimeMillis());
    if (tickets.size() > 1000) throw new IllegalStateException("Too many outstanding tickets");
    var t = UUID.randomUUID().toString();
    tickets.put(t, System.currentTimeMillis() + 30000);
    return t;
  }

  public boolean consume(String ticket) {
    var expiry = tickets.remove(ticket);
    return expiry != null && expiry >= System.currentTimeMillis();
  }
}
