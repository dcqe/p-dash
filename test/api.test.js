import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../server/app.js';
test('API denies unauthenticated, cross-origin and DNS-rebinding requests; CRUD and validation', async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pdash-api-'));
  const app = await buildApp({ dir });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const headers = { host: '127.0.0.1:4310', authorization: `Bearer ${app.token}` };
  assert.equal(
    (await app.inject({ url: '/api/status', headers: { host: headers.host } })).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/status',
        headers: { ...headers, origin: 'https://evil.example' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: '/api/status', headers: { ...headers, host: 'evil.example' } }))
      .statusCode,
    403,
  );
  assert.equal(
    (await app.inject({ url: '/api/session', headers: { host: headers.host } })).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/session',
        headers: { host: headers.host, 'sec-fetch-site': 'cross-site' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/session',
        headers: { host: headers.host, 'sec-fetch-site': 'same-origin' },
      })
    ).statusCode,
    200,
  );
  const create = await app.inject({
    method: 'POST',
    url: '/api/commands',
    headers,
    payload: { name: 'test', command: 'echo hi', cwd: process.cwd() },
  });
  assert.equal(create.statusCode, 200);
  const c = create.json();
  assert.equal(
    (
      await app.inject({
        method: 'PATCH',
        url: `/api/commands/${c.id}`,
        headers,
        payload: { name: 'edited' },
      })
    ).json().name,
    'edited',
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/commands/${c.id}/resize`,
        headers,
        payload: { cols: 0, rows: 24 },
      })
    ).statusCode,
    400,
  );
  assert.equal((await app.inject({ url: '/api/logs?after=-1', headers })).statusCode, 400);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: `/api/commands/${c.id}/input`,
        headers,
        payload: { data: 'hi' },
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await app.inject({ method: 'DELETE', url: `/api/commands/${c.id}`, headers })).statusCode,
    200,
  );
  assert.equal(
    (await app.inject({ method: 'POST', url: `/api/commands/${c.id}/start`, headers })).statusCode,
    404,
  );
});
