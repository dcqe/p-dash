import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildApp } from './app.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PDASH_PORT || 4310);
const app = await buildApp({ root, port, dir: process.env.PDASH_DATA });
await app.listen({ port, host: '127.0.0.1' });
console.log(`p-dash is ready at http://127.0.0.1:${port}`);
console.log(`Local state: ${app.manager.dir}`);
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });
