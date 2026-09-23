import { spawn } from 'node:child_process';
const backend = spawn(process.execPath, ['server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, PDASH_DEV: '1' },
});
const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
  stdio: 'inherit',
});
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
  process.exitCode = code;
}
backend.on('exit', (code) => close(code || 0));
frontend.on('exit', (code) => close(code || 0));
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
