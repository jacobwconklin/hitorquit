import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { createBackend } from '../src/server';
import { createRemoteSession, type RemoteSession, type Socket } from '../../hoq-fe/src/session/remoteSession';
import { createFunLocalSession } from '../../hoq-fe/src/session/funLocalSession';
import { funRules } from '../../hoq-fe/src/game/specials/framework';
import type { Identity } from '../../hoq-fe/src/session/identityStore';

async function until(check: () => boolean) {
  const end = Date.now() + 3000;
  while (!check()) { if (Date.now() > end) throw new Error('Timed out waiting for session state'); await new Promise(r => setTimeout(r, 5)); }
}
test('frontend adapters host, join, configure, play with solo parity, wait, reconnect, and transfer host', async () => {
  const backend = createBackend(); const remotes: RemoteSession[] = []; const sockets: WebSocket[] = [];
  await new Promise<void>(resolve => backend.server.listen(0, '127.0.0.1', resolve));
  const endpoint = `ws://127.0.0.1:${(backend.server.address() as { port: number }).port}/ws`;
  let saved: Identity | undefined;
  function client(mode: 'host' | 'join' | 'resume', joinCode?: string, identity: Identity = { playerId: randomUUID() }) {
    const session = createRemoteSession({ mode, joinCode, identity, endpoint, name: mode, config: { target: 30, turnMs: null }, uuid: randomUUID,
      connect(url) { const socket = new WebSocket(url); sockets.push(socket); return socket as unknown as Socket; },
      async save(value) { if (mode === 'host') saved = value; }, retryMs: 5 });
    remotes.push(session); return session;
  }
  try {
    const host = client('host'); await until(() => host.getRemoteSnapshot().members.length === 1);
    const joiner = client('join', host.getRemoteSnapshot().joinCode); await until(() => host.getRemoteSnapshot().members.length === 2);
    joiner.configure({ target: 50, turnMs: null }); assert.equal(host.getRemoteSnapshot().config.target, 30);
    host.configure({ target: 50, turnMs: null }); await until(() => joiner.getRemoteSnapshot().config.target === 50);
    host.advanceRound(); await until(() => !!joiner.getRemoteSnapshot().game);
    const serverSession = [...backend.sessions.sessionsById.values()][0];
    const initial = serverSession.game!;
    const deck = [...initial.players.flatMap(p => p.hand), ...initial.deck];
    const solo = createFunLocalSession({ seats: initial.players, config: initial.config, rules: { ...funRules, createDeck: () => deck }, random: () => 0.999999 });
    try {
      for (const session of [host, joiner]) {
        const before = session.getSnapshot(); const command = { playerId: before.localPlayerId!, turnId: before.game.turnId, action: 'quit' as const };
        solo.submit(command); session.submit(command);
        await until(() => host.getSnapshot().game.turnId === solo.getSnapshot().game.turnId && joiner.getSnapshot().game.turnId === solo.getSnapshot().game.turnId);
        const normalize = (game: typeof initial) => ({ ...game, deck: [...game.deck].sort((a, b) => a.id.localeCompare(b.id)) });
        assert.deepEqual(normalize(host.getSnapshot().game), normalize(solo.getSnapshot().game));
      }
    } finally { solo.dispose(); }
    host.advanceRound(); await until(() => host.getSnapshot().game.round === 2);
    const late = client('join', host.getRemoteSnapshot().joinCode); await until(() => late.getRemoteSnapshot().members.length === 3);
    assert.equal(late.getRemoteSnapshot().game!.players.length, 2);
    const hostSeat = host.getRemoteSnapshot().seatId;
    sockets[0].terminate();
    await until(() => host.getRemoteSnapshot().connected && host.getRemoteSnapshot().hostSeatId !== hostSeat);
    assert.equal(host.getRemoteSnapshot().seatId, hostSeat);
    assert.ok(saved?.sessionId);
    // Reload uses persisted private IDs and replaces the prior connection.
    const restored = client('resume', undefined, saved!); await until(() => restored.getRemoteSnapshot().connected);
    assert.equal(restored.getRemoteSnapshot().seatId, hostSeat);
    const newHost = remotes.find(s => s.getRemoteSnapshot().connected && s.getRemoteSnapshot().seatId === s.getRemoteSnapshot().hostSeatId)!;
    const oldHostSeat = newHost.getRemoteSnapshot().seatId;
    await newHost.leave();
    await until(() => restored.getRemoteSnapshot().hostSeatId !== oldHostSeat);
    const eligible = restored.getRemoteSnapshot().members.filter(m => m.connected).map(m => m.seatId);
    assert.ok(eligible.includes(restored.getRemoteSnapshot().hostSeatId!));
  } finally { remotes.forEach(s => s.dispose()); sockets.forEach(s => s.terminate()); await backend.close(); }
});
