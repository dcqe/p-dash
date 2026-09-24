package com.example.dash;

import com.example.dash.process.*;
import io.quarkus.runtime.*;
import io.quarkus.runtime.annotations.QuarkusMain;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.awt.Desktop;
import java.net.URI;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@QuarkusMain
public class DashApplication implements QuarkusApplication {
  @Inject ProcessConfigLoader configs;
  @Inject ProcessManager processes;

  @ConfigProperty(name = "pdash.owner-pid", defaultValue = "0")
  long owner;

  @ConfigProperty(name = "pdash.open-browser", defaultValue = "false")
  boolean browser;

  @ConfigProperty(name = "quarkus.http.port")
  int port;

  void start(@Observes StartupEvent event) throws Exception {
    configs.load();
  }

  void stop(@Observes ShutdownEvent event) {
    processes.shutdown();
  }

  public int run(String... args) throws Exception {
    if (owner > 0)
      Thread.ofPlatform()
          .daemon()
          .name("runner-owner-watch")
          .start(
              () -> {
                try {
                  while (ProcessHandle.of(owner).map(ProcessHandle::isAlive).orElse(false))
                    Thread.sleep(500);
                  Quarkus.asyncExit();
                } catch (InterruptedException ignored) {
                }
              });
    String url = "http://127.0.0.1:" + port;
    System.out.println(
        "p-dash: " + url + " | MCP: " + url + "/mcp | Ctrl+C stops p-dash and managed commands.");
    if (browser) {
      try {
        if (Desktop.isDesktopSupported()) Desktop.getDesktop().browse(URI.create(url));
      } catch (Exception e) {
        System.err.println("Open " + url + " in your browser.");
      }
    }
    Quarkus.waitForExit();
    return 0;
  }
}
