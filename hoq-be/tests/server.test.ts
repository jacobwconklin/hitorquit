import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { createBackend } from '../src/server';

test('real WebSocket clients complete a round and reclaim a disconnected seat', async () => {
  const backend = createBackend(); const clients: WebSocket[] = [];
  await new Promise<void>(resolve => backend.server.listen(0, '127.0.0.1', resolve));
  const address = backend.server.address() as { port: number };
  async function connect() {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`); clients.push(ws);
    const messages: any[] = []; ws.on('message', data => messages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    return { ws, messages, async request(type: string, payload = {}) {
      const requestId = randomUUID(); ws.send(JSON.stringify({ type, payload, requestId }));
      const until = Date.now() + 2000;
      while (Date.now() < until) {
        const result = messages.find(m => m.requestId === requestId);
        if (result) { assert.notEqual(result.type, 'request.error', JSON.stringify(result)); return result; }
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      throw new Error(`Timed out: ${type}`);
    } };
  }
  try {
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/health`)).status, 200);
    const a = await connect(); const b = await connect(); const aid = randomUUID(); const bid = randomUUID();
    const joined = await a.request('session.create', { playerId: aid, name: 'A', config: { target: 30, turnMs: null } });
    await b.request('session.join', { playerId: bid, name: 'B', joinCode: joined.joinCode.toLowerCase() });
    await a.request('round.start');
    await a.request('player.action', { action: 'quit', round: 1, turnId: 1 });
    await b.request('player.action', { action: 'quit', round: 1, turnId: 2 });
    assert.equal(backend.sessions.sessionsById.get(joined.sessionId)!.game!.phase, 'round-over');
    await new Promise<void>(resolve => { b.ws.once('close', () => resolve()); b.ws.close(); });
    const c = await connect(); const resumed = await c.request('session.resume', { playerId: bid, sessionId: joined.sessionId });
    assert.equal(resumed.playerId, bid);
    await a.request('round.start');
    const session = backend.sessions.sessionsById.get(joined.sessionId)!;
    assert.equal(session.game!.round, 2); assert.equal(session.members.size, 2);
    assert.ok(a.messages.filter(m => m.type === 'session.state').length >= 4);
  } finally { clients.forEach(c => c.terminate()); await backend.close(); }
});
