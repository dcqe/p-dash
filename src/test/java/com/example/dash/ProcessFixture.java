package com.example.dash;

/** Standalone child JVM used by lifecycle tests; deliberately has no framework dependencies. */
public final class ProcessFixture {
  public static void main(String[] args) throws Exception {
    if (args[0].equals("ready-on-input")) {
      new java.util.Scanner(System.in).nextLine();
      System.out.print("\u001b[32mREA");
      System.out.flush();
      Thread.sleep(100);
      System.out.println("DY\u001b[0m");
    }
    if (args[0].equals("exit-zero")) {
      System.out.println("DONE");
      return;
    }
    if (args[0].equals("exit")) {
      System.err.println("FIXTURE_STDERR");
      System.out.println("FIXTURE_DONE");
      System.exit(7);
    }
    if (args[0].equals("parent")) {
      String executable =
          java.nio.file.Path.of(System.getProperty("java.home"), "bin", "java.exe").toString();
      if (!System.getProperty("os.name").startsWith("Windows"))
        executable = executable.substring(0, executable.length() - 4);
      var child =
          new ProcessBuilder(
                  executable,
                  "-cp",
                  System.getProperty("java.class.path"),
                  ProcessFixture.class.getName(),
                  "child")
              .start();
      System.out.println("CHILD_PID=" + child.pid());
    }
    Thread.sleep(120000);
  }
}
