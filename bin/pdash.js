#!/usr/bin/env node
import { request, connection } from './client.js';
const [action = 'help', id, value] = process.argv.slice(2);
try {
  let result;
  switch (action) {
    case 'status':
      result = await request('/status');
      break;
    case 'list':
      result = await request('/commands');
      break;
    case 'create':
      result = await request('/commands', 'POST', JSON.parse(id));
      break;
    case 'update':
      result = await request(`/commands/${id}`, 'PATCH', JSON.parse(value));
      break;
    case 'delete':
      result = await request(`/commands/${id}`, 'DELETE');
      break;
    case 'start':
    case 'stop':
    case 'restart':
      result = await request(`/commands/${id}/${action}`, 'POST');
      break;
    case 'input':
      result = await request(`/commands/${id}/input`, 'POST', { data: value });
      break;
    case 'resize': {
      const [cols, rows] = value.split('x').map(Number);
      result = await request(`/commands/${id}/resize`, 'POST', { cols, rows });
      break;
    }
    case 'logs':
      result = await request(
        `/logs?ids=${encodeURIComponent(id || '')}&after=${Number(value || 0)}&plain=true`,
      );
      break;
    case 'groups':
      result = await request('/groups');
      break;
    case 'group-create':
      result = await request('/groups', 'POST', JSON.parse(id));
      break;
    case 'group-update':
      result = await request(`/groups/${id}`, 'PUT', JSON.parse(value));
      break;
    case 'group-delete':
      result = await request(`/groups/${id}`, 'DELETE');
      break;
    case 'group-start':
    case 'group-stop':
    case 'group-restart':
      result = await request(`/groups/${id}/${action.slice(6)}`, 'POST');
      break;
    case 'watch': {
      const { url, token } = connection();
      const res = await fetch(`${url}/api/events?after=${Number(id || 0)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      for await (const chunk of res.body) process.stdout.write(chunk);
      break;
    }
    default:
      console.log(
        'p-dash CLI (JSON output)\nstatus | list | create <json> | update <id> <json> | delete <id>\nstart|stop|restart <id> | input <id> <text> | resize <id> <cols>x<rows>\nlogs [id,id] [after] | watch [after]\ngroups | group-create <json> | group-update <id> <json> | group-delete <id>\ngroup-start|group-stop|group-restart <id>',
      );
  }
  if (result !== undefined) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({ error: error.message }));
  process.exitCode = 1;
}
