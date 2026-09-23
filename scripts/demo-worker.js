const name = process.argv[2] || 'service';
const color = process.argv[3] || '32';
const names = { api: 'Gateway', worker: 'Job worker', web: 'Web frontend' };
let count = 0;
const log = (level, message) =>
  console.log(
    `\x1b[90m${new Date().toLocaleTimeString('en-GB')}\x1b[0m \x1b[${color}m${level.padEnd(5)}\x1b[0m \x1b[90m[${name}]\x1b[0m ${message}`,
  );
log('INFO', `${names[name] || name} started · simulated demo process`);
log('READY', 'Listening for work. Press a key to interact.');
const messages =
  name === 'api'
    ? [
        'GET /api/health → 200 · 2ms',
        'GET /api/orders → 200 · 18ms',
        'POST /api/events → 202 · 4ms',
        'Connection pool healthy · 3 / 20 active',
      ]
    : name === 'worker'
      ? [
          'Queue poll complete · no pending jobs',
          'Processed notification batch · 12 items',
          'Heartbeat sent · worker online',
          'Scheduled cleanup completed · 24ms',
        ]
      : [
          'Client connected · hot reload ready',
          'GET /dashboard → 200 · 12ms',
          'Rebuilt routes in 38ms',
          'Assets served from local cache',
        ];
setInterval(
  () =>
    log(
      ++count % 11 === 0 ? 'WARN' : 'INFO',
      count % 11 === 0
        ? 'Demo warning: upstream response slower than usual · retry succeeded'
        : messages[count % messages.length],
    ),
  name === 'api' ? 2200 : name === 'worker' ? 4100 : 3300,
);
process.stdin.on('data', (data) => {
  if (data.includes(3)) process.exit(0);
  log('INPUT', `Received: ${data.toString().trim()}`);
});
process.on('SIGINT', () => {
  log('INFO', 'Shutting down gracefully');
  process.exit(0);
});
