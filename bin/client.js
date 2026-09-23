import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function connection() {
  return {
    url: process.env.PDASH_URL || 'http://127.0.0.1:4310',
    token:
      process.env.PDASH_TOKEN ||
      readFileSync(
        path.join(process.env.PDASH_DATA || path.join(root, '.pdash'), 'token'),
        'utf8',
      ).trim(),
  };
}
export async function request(route, method = 'GET', body) {
  const { url, token } = connection();
  const response = await fetch(url + '/api' + route, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
