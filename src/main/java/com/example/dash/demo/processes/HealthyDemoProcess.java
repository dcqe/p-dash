package com.example.dash.demo.processes;

import com.example.dash.demo.DemoProcess;

public final class HealthyDemoProcess implements DemoProcess {
  public void run() throws Exception {
    System.out.println("\u001b[32mREADY\u001b[0m Healthy Java demo started");
    int counter = 0;
    while (true) {
      Thread.sleep(2000);
      System.out.printf("\u001b[32mINFO\u001b[0m Heartbeat #%d - application healthy%n", ++counter);
    }
  }
}
