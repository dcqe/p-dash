export async function restartAll(commands, request, clear, onStart) {
  const stopResults = await Promise.allSettled(commands.map(async (command) => {
    const stopped = await request(`/commands/${command.id}/stop`, 'POST');
    if (stopped.alive) throw new Error(`${command.name} is still alive`);
  }));
  checkResults(stopResults, 'Stop');

  const { cursor } = await request('/status');
  await clear(cursor);

  const startResults = await Promise.allSettled(commands.map(async (command) => {
    onStart(command.id);
    await request(`/commands/${command.id}/start`, 'POST');
  }));
  checkResults(startResults, 'Start');
}

function checkResults(results, operation) {
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) {
    throw new Error(`${operation} failed: ${failures.map(({ reason }) => reason.message || String(reason)).join('; ')}`);
  }
}
