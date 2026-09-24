package com.example.dash.demo.processes;

import com.example.dash.demo.DemoProcess;
import java.util.concurrent.ThreadLocalRandom;

public final class ChattyDemoProcess implements DemoProcess {
  public void run() throws Exception {
    System.out.println("\u001b[32mREADY\u001b[0m Chatty Java demo started");
    while (true) {
      Thread.sleep(ThreadLocalRandom.current().nextLong(100, 700));
      System.out.printf(
          "\u001b[36mDEBUG\u001b[0m processed event id=%d%n",
          ThreadLocalRandom.current().nextInt(10000));
    }
  }
}
