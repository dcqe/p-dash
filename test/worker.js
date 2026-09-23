console.log('\x1b[32mREADY\x1b[0m');
process.stdin.on('data', (data) => console.log('ECHO:' + data.toString().trim()));
process.on('SIGINT', () => {});
setInterval(() => {}, 1000);
import { spawn } from 'node:child_process';
const descendant = spawn(
  process.execPath,
  ['-e', 'process.on("SIGINT",()=>{});setInterval(()=>{},1000)'],
  { windowsHide: true, stdio: 'ignore' },
);
console.log(`CHILD_PID:${descendant.pid}`);
