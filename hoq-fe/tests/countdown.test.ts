import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteSession, type Socket } from '../src/session/remoteSession';
import { remainingTurnMs } from '../src/session/countdown';
import { createGame } from '../src/game/engine';
import { standardRules } from '../src/game/standardRules';

test('remote countdown ignores device clock skew and jumps, refreshes on hits and resume', t => {
  let wall = 120000, mono = 500;
  t.mock.method(Date, 'now', () => wall);
  t.mock.method(performance, 'now', () => mono);
  const sockets: Socket[] = [];
  let requestId = 0;
  const session = createRemoteSession({
    endpoint: 'ws://test', identity: { playerId: 'private', sessionId: 'session' }, name: 'C', mode: 'resume',
    config: { target: 30, turnMs: 10000 }, uuid: () => String(++requestId), save: async () => {},
    connect() {
      const socket: Socket = { readyState: 1, send() {}, close() {}, onopen: null, onmessage: null, onclose: null, onerror: null };
      sockets.push(socket); return socket;
    },
  });
  const game = createGame(['A', 'B', 'C'].map(id => ({ id, name: id, controller: 'human' as const })),
    { target: 30, turnMs: 10000 }, standardRules.createDeck());
  game.players[0].status = game.players[1].status = 'quit'; game.activeIndex = 2;
  const receive = (message: object) => sockets.at(-1)!.onmessage!({ data: JSON.stringify(message) });
  const joined = () => receive({ type: 'session.joined', sessionId: 'session', seatId: 'C', joinCode: 'ABCDEF' });
  const state = (revision: number, serverNow: number | undefined, deadline: number | null) => receive({
    type: 'session.state', revision, serverNow, deadline, game: { ...game, turnId: revision },
    config: game.config, members: [], hostSeatId: 'A', maxPlayers: 8, joinCode: 'ABCDEF', events: [],
  });
  try {
    joined(); state(3, 100000, 110000);
    assert.equal(remainingTurnMs(session.getSnapshot()), 10000);
    mono += 3000; wall += 3600000;
    assert.equal(remainingTurnMs(session.getSnapshot()), 7000);
    state(4, 103000, 113000); // The same player hits and receives another turn.
    assert.equal(remainingTurnMs(session.getSnapshot()), 10000);
    mono += 1000; wall = 0;
    assert.equal(remainingTurnMs(session.getSnapshot()), 9000);
    state(3, 100000, 110000); // Ignore stale state without resetting the clock.
    assert.equal(remainingTurnMs(session.getSnapshot()), 9000);
    receive({ type: 'request.ok' });
    assert.equal(remainingTurnMs(session.getSnapshot()), 9000);
    session.resume(); mono += 2000; joined(); state(4, 106000, 113000);
    assert.equal(remainingTurnMs(session.getSnapshot()), 7000);
    mono += 8000;
    assert.equal(remainingTurnMs(session.getSnapshot()), 0);
    state(5, 114000, null);
    assert.equal(remainingTurnMs(session.getSnapshot()), 0);
    wall = 100000; state(6, undefined, 110000); // Older backend compatibility.
    assert.equal(remainingTurnMs(session.getSnapshot()), 10000);
  } finally { session.dispose(); }
});

test('solo countdown retains its local deadline', () => {
  assert.equal(remainingTurnMs({ deadline: 10000 }, 999999, 7000), 3000);
  assert.equal(remainingTurnMs({ deadline: 10000 }, 0, 11000), 0);
  assert.equal(remainingTurnMs({ deadline: null }, 0, 0), 0);
});
