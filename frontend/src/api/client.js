let token;
export async function api(route, method = 'GET', body) {
  if (!token) {
    const response = await fetch('/api/session');
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `Could not establish a session (HTTP ${response.status})`);
    }
    token = (await response.json()).token;
  }
  const res = await fetch('/api' + route, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
