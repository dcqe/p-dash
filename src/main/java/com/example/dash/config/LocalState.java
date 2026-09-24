package com.example.dash.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** The only place that knows where private local state lives. */
@ApplicationScoped
public class LocalState {
  @ConfigProperty(name = "pdash.data")
  String directory;

  @Inject ObjectMapper mapper;
  private Path root;
  private java.nio.channels.FileChannel lockChannel;
  private java.nio.channels.FileLock lock;

  @PostConstruct
  void init() {
    root = Path.of(directory).toAbsolutePath().normalize();
    try {
      Files.createDirectories(root);
      lockChannel =
          java.nio.channels.FileChannel.open(
              root.resolve("owner.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
      lock = lockChannel.tryLock();
      if (lock == null) throw new IllegalStateException("Another p-dash instance owns " + root);
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @jakarta.annotation.PreDestroy
  void unlock() throws IOException {
    if (lock != null) lock.release();
    if (lockChannel != null) lockChannel.close();
  }

  public Path root() {
    return root;
  }

  public Path file(String name) {
    return root.resolve(name);
  }

  public <T> T read(String name, Class<T> type, T fallback) {
    if (!Files.exists(file(name))) return fallback;
    try {
      return mapper.readValue(file(name).toFile(), type);
    } catch (IOException e) {
      throw new IllegalStateException(
          "Cannot read " + file(name) + "; original file was preserved", e);
    }
  }

  public synchronized void write(String name, Object value) {
    Path temporary = file(name + ".tmp");
    try {
      mapper.writeValue(temporary.toFile(), value);
      restrict(temporary);
      try {
        Files.move(
            temporary,
            file(name),
            StandardCopyOption.ATOMIC_MOVE,
            StandardCopyOption.REPLACE_EXISTING);
      } catch (AtomicMoveNotSupportedException e) {
        Files.move(temporary, file(name), StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException e) {
      throw new IllegalStateException("Cannot save " + file(name), e);
    }
  }

  public static void restrict(Path file) throws IOException {
    if (Files.getFileStore(file).supportsFileAttributeView("posix"))
      Files.setPosixFilePermissions(file, PosixFilePermissions.fromString("rw-------"));
  }
}
