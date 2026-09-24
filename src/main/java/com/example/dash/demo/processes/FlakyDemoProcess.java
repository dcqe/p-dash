package com.example.dash.demo.processes;

import com.example.dash.demo.DemoProcess;

public final class FlakyDemoProcess implements DemoProcess {
  public void run() throws Exception {
    System.out.println("\u001b[32mREADY\u001b[0m Flaky Java demo started");
    int n = 0;
    while (true) {
      Thread.sleep(1500);
      n++;
      if (n % 7 == 0)
        System.err.println("\u001b[31mERROR\u001b[0m Demo database connection failed");
      else if (n % 3 == 0)
        System.out.println("\u001b[33mWARN\u001b[0m Demo response time above threshold");
      else System.out.println("\u001b[32mINFO\u001b[0m Request processed successfully");
    }
  }
}
