import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { Manager, commandSchema } from './manager.js';

export async function buildApp({ dir, port = 4310, root = process.cwd(), managerOptions } = {}) {
  const manager = new Manager(dir || path.join(root, '.pdash'), managerOptions);
  const tokenFile = path.join(manager.dir, 'token');
  const token = existsSync(tokenFile)
    ? readFileSync(tokenFile, 'utf8').trim()
    : randomBytes(32).toString('hex');
  if (!existsSync(tokenFile)) writeFileSync(tokenFile, token, { mode: 0o600 });
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  app.decorate('manager', manager);
  app.decorate('token', token);
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  if (process.env.PDASH_DEV === '1') origins.add('http://127.0.0.1:5173');
  app.addHook('onRequest', async (req, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('Cross-Origin-Resource-Policy', 'same-origin');
    if (!hosts.has(req.headers.host)) return reply.code(403).send({ error: 'Invalid Host' });
    if (req.headers.origin && !origins.has(req.headers.origin))
      return reply.code(403).send({ error: 'Invalid Origin' });
    if (!req.routeOptions.url?.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (req.routeOptions.url === '/api/session') {
      if (!['same-origin', 'same-site'].includes(req.headers['sec-fetch-site']))
        return reply.code(403).send({
          error:
            'Session bootstrap requires a same-origin browser. Agents use the local token file.',
        });
      return;
    }
    const provided = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, ''));
    const expected = Buffer.from(token);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected))
      return reply.code(401).send({ error: 'Valid bearer token required' });
  });
  app.setErrorHandler((error, req, reply) => {
    reply.code(error instanceof ZodError ? 400 : error.statusCode || 500).send({
      error:
        error instanceof ZodError
          ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
          : error.message,
    });
  });
  app.get('/api/session', () => ({ token }));
  app.get('/api/status', () => ({
    name: 'p-dash',
    version: '0.1.0',
    cwd: root,
    platform: process.platform,
    cursor: manager.seq,
    uptime: process.uptime(),
    commands: manager.list(),
    groups: manager.groups,
  }));
  app.get('/api/commands', () => manager.list());
  app.post('/api/commands', (req) => manager.create(req.body));
  app.patch('/api/commands/:id', (req) =>
    manager.update(req.params.id, commandSchema.partial().parse(req.body)),
  );
  app.delete('/api/commands/:id', (req) => manager.remove(req.params.id));
  for (const action of ['start', 'stop', 'restart'])
    app.post(`/api/commands/:id/${action}`, (req) => manager[action](req.params.id));
  app.post('/api/commands/:id/input', (req) =>
    manager.input(req.params.id, z.object({ data: z.string().max(16384) }).parse(req.body).data),
  );
  app.post('/api/commands/:id/resize', (req) => {
    const b = z
      .object({ cols: z.number().int().min(2).max(500), rows: z.number().int().min(2).max(200) })
      .parse(req.body);
    return manager.resize(req.params.id, b.cols, b.rows);
  });
  app.get('/api/groups', () => manager.groups);
  app.post('/api/groups', (req) => manager.group(req.body));
  app.put('/api/groups/:id', (req) => manager.group(req.body, req.params.id));
  app.delete('/api/groups/:id', (req) => manager.removeGroup(req.params.id));
  for (const action of ['start', 'stop', 'restart'])
    app.post(`/api/groups/:id/${action}`, (req) => manager.groupAction(req.params.id, action));
  const querySchema = z.object({
    after: z.coerce.number().int().min(0).default(0),
    ids: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(12000).default(2000),
    plain: z.enum(['true', 'false']).default('false'),
  });
  app.get('/api/logs', (req) => {
    const q = querySchema.parse(req.query);
    return manager.logs({
      ...q,
      ids: q.ids?.split(',').filter(Boolean),
      plain: q.plain === 'true',
    });
  });
  const streams = new Set();
  app.get('/api/events', (req, reply) => {
    const q = querySchema.parse(req.query);
    const raw = reply.raw;
    reply.hijack();
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event) => {
      if (raw.destroyed) return;
      if (raw.writableLength > 1024 * 1024) return raw.destroy();
      raw.write(`id: ${event.seq || manager.seq}\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const snapshot = manager.logs({ after: q.after, limit: 12000 });
    send({
      type: 'snapshot',
      seq: manager.seq,
      ...snapshot,
      commands: manager.list(),
      groups: manager.groups,
    });
    manager.on('event', send);
    streams.add(raw);
    const heartbeat = setInterval(() => raw.write(': heartbeat\n\n'), 15000);
    raw.on('close', () => {
      clearInterval(heartbeat);
      manager.off('event', send);
      streams.delete(raw);
    });
  });
  app.addHook('preClose', async () => {
    for (const stream of streams) stream.end();
    await manager.close();
  });
  if (existsSync(path.join(root, 'dist')))
    await app.register(staticFiles, { root: path.join(root, 'dist') });
  else
    app.get('/', (req, reply) =>
      reply
        .type('text/plain')
        .send('Run npm run build, then restart p-dash. For development use npm run dev.'),
    );
  return app;
}
