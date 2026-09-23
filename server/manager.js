import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { PtyProcess } from './pty-process.js';
import { z } from 'zod';

export const commandSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[^\x00-\x1f\x7f]*$/, 'Control characters are not allowed'),
    command: z.string().trim().min(1).max(8192),
    cwd: z.string().min(1),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default('#a5d87a'),
    env: z.record(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/), z.string()).default({}),
  })
  .strict();
export const groupSchema = z
  .object({ name: z.string().trim().min(1).max(80), processIds: z.array(z.string()).max(100) })
  .strict();
export class Manager extends EventEmitter {
  constructor(dir, { graceMs = 3000, maxBytes = 4 * 1024 * 1024, maxEvents = 12000 } = {}) {
    super();
    this.dir = dir;
    this.graceMs = graceMs;
    this.maxBytes = maxBytes;
    this.maxEvents = maxEvents;
    this.live = new Map();
    this.starts = new Map();
    this.stops = new Map();
    this.events = [];
    this.seq = 0;
    this.bytes = 0;
    this.closing = false;
    mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'state.json');
    const saved = existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : {};
    this.commands = saved.commands || [];
    this.groups = saved.groups || [];
    this.events = saved.events || [];
    this.seq = saved.seq || 0;
    this.bytes = this.events.reduce((n, e) => n + Buffer.byteLength(JSON.stringify(e)), 0);
    this.states = new Map(this.commands.map((c) => [c.id, { status: 'stopped', exitCode: null }]));
  }
  persist() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    writeFileSync(
      this.file + '.tmp',
      JSON.stringify({
        commands: this.commands,
        groups: this.groups,
        events: this.events,
        seq: this.seq,
      }),
      { mode: 0o600 },
    );
    renameSync(this.file + '.tmp', this.file);
  }
  scheduleSave() {
    if (!this.saveTimer)
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.persist();
      }, 1000).unref();
  }
  emitEvent(type, data) {
    const event = { seq: ++this.seq, time: new Date().toISOString(), type, ...data };
    this.events.push(event);
    this.bytes += Buffer.byteLength(JSON.stringify(event));
    while (this.events.length > this.maxEvents || this.bytes > this.maxBytes)
      this.bytes -= Buffer.byteLength(JSON.stringify(this.events.shift()));
    this.scheduleSave();
    this.emit('event', event);
    return event;
  }
  definition(id) {
    const c = this.commands.find((c) => c.id === id);
    if (!c) throw Object.assign(new Error('Command not found'), { statusCode: 404 });
    return c;
  }
  view(id) {
    const { env, ...c } = this.definition(id);
    return {
      ...c,
      envKeys: Object.keys(env),
      ...this.states.get(id),
      pid: this.live.get(id)?.pid ?? null,
    };
  }
  list() {
    return this.commands.map((c) => this.view(c.id));
  }
  create(input) {
    const c = { id: randomUUID(), ...commandSchema.parse(input) };
    this.checkCwd(c.cwd);
    this.commands.push(c);
    this.states.set(c.id, { status: 'stopped', exitCode: null });
    this.persist();
    this.emitEvent('state', { processId: c.id, process: this.view(c.id) });
    return this.view(c.id);
  }
  checkCwd(cwd) {
    if (!path.isAbsolute(cwd) || !existsSync(cwd) || !statSync(cwd).isDirectory())
      throw Object.assign(new Error('Working directory must be an existing absolute directory'), {
        statusCode: 400,
      });
  }
  update(id, input) {
    const c = this.definition(id);
    if (this.live.has(id))
      throw Object.assign(new Error('Stop the command before editing'), { statusCode: 409 });
    const { id: ignored, ...old } = c;
    const next = commandSchema.parse({ ...old, ...input });
    this.checkCwd(next.cwd);
    Object.assign(c, next);
    this.persist();
    this.emitEvent('state', { processId: id, process: this.view(id) });
    return this.view(id);
  }
  remove(id) {
    this.definition(id);
    if (this.live.has(id))
      throw Object.assign(new Error('Stop the command before deleting'), { statusCode: 409 });
    this.commands = this.commands.filter((c) => c.id !== id);
    this.groups.forEach((g) => (g.processIds = g.processIds.filter((p) => p !== id)));
    this.states.delete(id);
    this.persist();
    this.emitEvent('removed', { processId: id });
    this.emitEvent('groups', { groups: this.groups });
    return { ok: true };
  }
  group(input, id = randomUUID()) {
    const g = { id, ...groupSchema.parse(input) };
    g.processIds = [...new Set(g.processIds)];
    g.processIds.forEach((p) => this.definition(p));
    this.groups = [...this.groups.filter((x) => x.id !== id), g];
    this.persist();
    this.emitEvent('groups', { groups: this.groups });
    return g;
  }
  removeGroup(id) {
    this.groups = this.groups.filter((g) => g.id !== id);
    this.persist();
    this.emitEvent('groups', { groups: this.groups });
    return { ok: true };
  }
  async groupAction(id, action) {
    const g = this.groups.find((g) => g.id === id);
    if (!g) throw Object.assign(new Error('Group not found'), { statusCode: 404 });
    return Promise.all(
      g.processIds.map(async (id) => {
        try {
          return { id, ok: true, process: await this[action](id) };
        } catch (e) {
          return { id, ok: false, error: e.message };
        }
      }),
    );
  }
  start(id) {
    if (this.starts.has(id)) return this.starts.get(id);
    const promise = this.launch(id).finally(() => this.starts.delete(id));
    this.starts.set(id, promise);
    return promise;
  }
  async launch(id) {
    if (this.closing) throw new Error('Server is shutting down');
    const c = this.definition(id);
    if (this.stops.has(id))
      throw Object.assign(new Error('Command is stopping'), { statusCode: 409 });
    if (this.live.has(id)) return this.view(id);
    this.checkCwd(c.cwd);
    const runId = randomUUID();
    this.states.set(id, {
      status: 'starting',
      runId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitCode: null,
    });
    this.emitEvent('state', { processId: id, process: this.view(id) });
    try {
      const child = new PtyProcess(c);
      this.live.set(id, child);
      child.onData((data) => {
        for (let i = 0; i < data.length; i += 16384)
          this.emitEvent('output', { processId: id, runId, data: data.slice(i, i + 16384) });
      });
      child.onExit(({ exitCode, signal }) => {
        if (this.live.get(id) !== child) return;
        this.live.delete(id);
        const stopping = this.states.get(id).status === 'stopping';
        this.states.set(id, {
          ...this.states.get(id),
          status: stopping ? 'stopped' : exitCode === 0 ? 'exited' : 'failed',
          exitCode,
          signal,
          endedAt: new Date().toISOString(),
        });
        this.emitEvent('state', { processId: id, process: this.view(id) });
      });
      await child.ready;
      if (this.live.get(id) === child) this.states.get(id).status = 'running';
    } catch (e) {
      this.states.set(id, {
        ...this.states.get(id),
        status: 'failed',
        error: e.message,
        endedAt: new Date().toISOString(),
      });
      this.emitEvent('state', { processId: id, process: this.view(id) });
      throw e;
    }
    this.emitEvent('state', { processId: id, process: this.view(id) });
    return this.view(id);
  }
  stop(id) {
    if (this.starts.has(id))
      return this.starts
        .get(id)
        .catch(() => {})
        .then(() => this.stop(id));
    this.definition(id);
    if (this.stops.has(id)) return this.stops.get(id);
    const child = this.live.get(id);
    if (!child) return Promise.resolve(this.view(id));
    const promise = this.stopChild(id, child).finally(() => this.stops.delete(id));
    this.stops.set(id, promise);
    return promise;
  }
  async stopChild(id, child) {
    this.states.get(id).status = 'stopping';
    this.emitEvent('state', { processId: id, process: this.view(id) });
    try {
      child.write('\x03');
    } catch {}
    const deadline = Date.now() + this.graceMs;
    while (this.live.get(id) === child && Date.now() < deadline)
      await new Promise((r) => setTimeout(r, 50));
    if (this.live.get(id) === child) {
      if (process.platform === 'win32')
        await new Promise((resolve) =>
          execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () =>
            resolve(),
          ),
        );
      else {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }
      try {
        child.kill();
      } catch {}
      const end = Date.now() + 5000;
      while (this.live.get(id) === child && Date.now() < end)
        await new Promise((r) => setTimeout(r, 50));
      if (this.live.get(id) === child)
        throw new Error(
          'Process termination did not complete; inspect the process before retrying',
        );
    }
    return this.view(id);
  }
  async restart(id) {
    await this.stop(id);
    return this.start(id);
  }
  input(id, data) {
    this.definition(id);
    const child = this.live.get(id);
    if (!child) throw Object.assign(new Error('Command is not running'), { statusCode: 409 });
    child.write(data);
    return { ok: true };
  }
  resize(id, cols, rows) {
    this.definition(id);
    this.live.get(id)?.resize(cols, rows);
    return { ok: true };
  }
  logs({ after = 0, ids = [], limit = 2000, plain = false } = {}) {
    const oldest = this.events[0]?.seq || this.seq + 1;
    const events = this.events
      .filter((e) => e.seq > after && (!ids.length || ids.includes(e.processId)))
      .slice(0, limit)
      .map((e) => (plain && e.data ? { ...e, data: stripVTControlCharacters(e.data) } : e));
    return {
      events,
      cursor: events.at(-1)?.seq ?? this.seq,
      latest: this.seq,
      truncated: after > 0 && after < oldest - 1,
      oldest,
    };
  }
  async close() {
    this.closing = true;
    await Promise.allSettled([...this.starts.values()]);
    await Promise.all([...this.live.keys()].map((id) => this.stop(id)));
    this.persist();
  }
}
