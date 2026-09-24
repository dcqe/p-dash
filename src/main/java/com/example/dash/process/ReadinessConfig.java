package com.example.dash.process;

import com.google.re2j.Pattern;
import java.net.URI;
import java.util.List;
import java.util.Set;

/** Startup readiness only; an OS process can be alive before this check succeeds. */
public record ReadinessConfig(String mode, String value, long timeoutMs) {
  public ReadinessConfig {
    mode = mode == null ? "log" : mode;
    if (!Set.of("auto", "log", "http", "process").contains(mode))
      throw new IllegalArgumentException("Readiness mode must be auto, log, http or process");
    value = value == null ? "" : value;
    timeoutMs = timeoutMs == 0 ? 120000 : timeoutMs;
    if (timeoutMs < 1000 || timeoutMs > 1800000)
      throw new IllegalArgumentException("Readiness timeout must be 1000–1800000 ms");
    if (mode.equals("log")) {
      if (value.isBlank() || value.length() > 1000)
        throw new IllegalArgumentException("Readiness pattern must be 1–1000 characters");
      Pattern.compile(value);
    }
    if (mode.equals("http")) {
      var uri = URI.create(value);
      if (uri.getHost() == null
          || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))
          || uri.getUserInfo() != null)
        throw new IllegalArgumentException(
            "Readiness URL must be an HTTP(S) URL without credentials");
    }
  }

  public static ReadinessConfig defaults(List<String> command) {
    boolean quarkus = String.join(" ", command).toLowerCase().contains("quarkus");
    return new ReadinessConfig(
        "log", quarkus ? "(?i)\\bstarted in\\b[^\\r\\n]*Listening on:" : "\\bREADY\\b", 120000);
  }
}
