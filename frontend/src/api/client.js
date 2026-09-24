let token;
export async function api(route, method = 'GET', body) {
  if (!token) {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('Could not establish a session');
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
