// A dedicated native host per terminal contains ConPTY handle lifetime and native faults.
import * as pty from 'node-pty';
let child;
let queuedBytes = 0;
const send = (message, done = () => {}) => {
  if (!process.connected) return done();
  const size = message.type === 'data' ? Buffer.byteLength(message.data) : 0;
  queuedBytes += size;
  if (queuedBytes > 256 * 1024) child?.pause();
  process.send(message, () => {
    queuedBytes -= size;
    if (queuedBytes < 128 * 1024) child?.resume();
    done();
  });
};
process.on('message', (message) => {
  try {
    if (message.type === 'spawn') {
      const windows = process.platform === 'win32';
      const { command, cwd, env } = message;
      child = pty.spawn(
        windows ? process.env.ComSpec || 'cmd.exe' : '/bin/sh',
        windows ? `/d /s /c "${command}"` : ['-c', command],
        {
          name: 'xterm-256color',
          useConptyDll: windows,
          cols: 120,
          rows: 30,
          cwd,
          env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', ...env },
        },
      );
      child.onData((data) => send({ type: 'data', data }));
      child.onExit(({ exitCode, signal }) => {
        // Flush the ordered IPC queue before closing the native host.
        send({ type: 'exit', exitCode, signal }, () => process.exit(0));
      });
      send({ type: 'ready', pid: child.pid });
    } else if (message.type === 'input') child?.write(message.data);
    else if (message.type === 'resize') child?.resize(message.cols, message.rows);
    else if (message.type === 'kill') child?.kill();
  } catch (error) {
    send({ type: 'error', error: error.message }, () => {
      if (!child) process.exit(1);
    });
  }
});
process.on('disconnect', () => {
  try {
    child?.kill();
  } catch {}
  setTimeout(() => process.exit(1), 1000);
});
