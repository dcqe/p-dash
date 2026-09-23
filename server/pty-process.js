import { fork } from 'node:child_process';
import { EventEmitter } from 'node:events';
export class PtyProcess extends EventEmitter {
  constructor(command) {
    super();
    this.pid = null;
    this.exited = false;
    this.host = fork(new URL('./pty-host.js', import.meta.url), [], {
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      windowsHide: true,
    });
    this.host.stderr.on('data', () => {}); // Native diagnostics never contaminate managed output.
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Terminal host did not initialize'));
        this.host.kill();
      }, 15000);
      timer.unref();
      this.host.on('message', (m) => {
        if (m.type === 'ready') {
          this.pid = m.pid;
          clearTimeout(timer);
          resolve(this);
        } else if (m.type === 'data') this.emit('data', m.data);
        else if (m.type === 'exit') {
          this.exited = true;
          this.emit('exit', m);
        } else if (m.type === 'error') {
          if (!this.pid) {
            clearTimeout(timer);
            reject(new Error(m.error));
          } else this.emit('data', `\r\n[p-dash terminal error: ${m.error}]\r\n`);
        }
      });
      this.host.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      this.host.on('exit', (code) => {
        clearTimeout(timer);
        if (!this.pid) reject(new Error('Terminal host exited during startup'));
        if (!this.exited) {
          this.exited = true;
          this.emit('exit', { exitCode: code || 1 });
        }
      });
    });
    this.host.send({ type: 'spawn', command: command.command, cwd: command.cwd, env: command.env });
  }
  send(message) {
    if (!this.host.connected) return;
    this.host.send(message, () => {});
  }
  write(data) {
    this.send({ type: 'input', data });
  }
  resize(cols, rows) {
    this.send({ type: 'resize', cols, rows });
  }
  kill() {
    this.send({ type: 'kill' });
  }
  onData(fn) {
    this.on('data', fn);
  }
  onExit(fn) {
    this.on('exit', fn);
  }
}
