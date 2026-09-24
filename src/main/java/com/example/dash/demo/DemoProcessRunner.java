package com.example.dash.demo;

import com.example.dash.demo.processes.*;
import java.util.Locale;

/** Standalone JVM entry point: no Quarkus bootstrap, dependencies or special manager behavior. */
public final class DemoProcessRunner {
  public static void main(String[] args) throws Exception {
    var type =
        DemoProcessType.valueOf((args.length == 0 ? "HEALTHY" : args[0]).toUpperCase(Locale.ROOT));
    Thread.ofVirtual()
        .start(
            () -> {
              try (var input = new java.util.Scanner(System.in)) {
                while (input.hasNextLine())
                  System.out.println("\u001b[36mINPUT\u001b[0m " + input.nextLine());
              }
            });
    DemoProcess process =
        switch (type) {
          case HEALTHY -> new HealthyDemoProcess();
          case FLAKY -> new FlakyDemoProcess();
          case CHATTY -> new ChattyDemoProcess();
        };
    process.run();
  }
}
