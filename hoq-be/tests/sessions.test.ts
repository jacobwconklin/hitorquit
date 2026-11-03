import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Sessions, type Peer } from '../src/sessions';
import { parseRequest, RequestError } from '../src/protocol';

class Client implements Peer {
  messages: any[] = []; closed = false; id = randomUUID();
  send(message: unknown) { this.messages.push(message); }
  close() { this.closed = true; }
}
function request(registry: Sessions, client: Client, type: string, payload = {}, requestId = randomUUID()) {
  registry.handle(client, parseRequest({ type, payload, requestId })); return requestId;
}
function setup(options: ConstructorParameters<typeof Sessions>[0] = {}) {
  const registry = new Sessions(options); const a = new Client(); const b = new Client();
  request(registry, a, 'session.create', { playerId: a.id, name: 'A', config: { target: 30, turnMs: null } });
  const session = [...registry.sessionsById.values()][0];
  request(registry, b, 'session.join', { playerId: b.id, name: 'B', joinCode: session.joinCode });
  return { registry, a, b, session };
}

test('last active player gets fresh deadlines and server time after consecutive hits', () => {
  let now = 100000;
  const { registry, a, b, session } = setup({ now: () => now });
  const c = new Client();
  try {
    request(registry, c, 'session.join', { playerId: c.id, name: 'C', joinCode: session.joinCode });
    request(registry, a, 'session.configure', { config: { target: 30, turnMs: 10000, enabledSpecials: [] } });
    request(registry, a, 'round.start');
    const act = (client: Client, action: string) => request(registry, client, 'player.action', { action, round: 1, turnId: session.game!.turnId });
    act(a, 'quit'); act(b, 'quit');
    for (let i = 0; i < 2; i++) {
      now += 3000;
      const player = session.game!.players[2];
      const ranks = player.hand.map(card => card.kind === 'standard' ? card.rank : 0);
      const safe = session.game!.deck.findIndex(card => card.kind === 'standard' && !ranks.includes(card.rank));
      session.game!.deck.unshift(session.game!.deck.splice(safe, 1)[0]);
      act(c, 'hit');
      assert.equal(session.game!.activeIndex, 2);
      assert.equal(session.game!.phase, 'playing');
      for (const client of [a, b, c]) {
        const snapshot = client.messages.filter(m => m.type === 'session.state').at(-1);
        assert.equal(snapshot.serverNow, now);
        assert.equal(snapshot.deadline - snapshot.serverNow, 10000);
      }
    }
    now += 2000;
    request(registry, c, 'session.sync');
    const snapshot = c.messages.filter(m => m.type === 'session.state').at(-1);
    assert.equal(snapshot.deadline - snapshot.serverNow, 8000);
  } finally { registry.dispose(); }
});
test('capacity is configurable; reconnect works when full and old socket close is harmless', () => {
  const { registry, a, b, session } = setup({ maxPlayers: 2 });
  try {
    const c = new Client();
    assert.throws(() => request(registry, c, 'session.join', { playerId: c.id, name: 'C', joinCode: session.joinCode }), /full/);
    request(registry, c, 'session.resume', { playerId: b.id, sessionId: session.id });
    registry.disconnect(b);
    assert.equal(b.closed, true); assert.equal(session.members.get(b.id)?.peer, c);
    const publicJson = JSON.stringify(registry.snapshot(session));
    assert.ok(!publicJson.includes(a.id)); assert.ok(!publicJson.includes(b.id));
  } finally { registry.dispose(); }
});
test('late joins are rejected throughout a match; actions are validated and deduplicated', () => {
  const { registry, a, b, session } = setup();
  try {
    request(registry, a, 'round.start');
    const c = new Client(); assert.throws(() => request(registry, c, 'session.join', { playerId: c.id, name: 'C', joinCode: session.joinCode }), /game has started/);
    assert.equal(session.game!.players.length, 2);
    const action = { action: 'quit', round: 1, turnId: session.game!.turnId };
    assert.throws(() => request(registry, c, 'player.action', action), (error: unknown) => error instanceof RequestError && error.code === 'NOT_JOINED');
    const id = request(registry, a, 'player.action', action);
    const revision = session.revision;
    request(registry, a, 'player.action', action, id); assert.equal(session.revision, revision);
    assert.throws(() => request(registry, a, 'player.action', action), /no longer active/);
    request(registry, b, 'player.action', { action: 'quit', round: 1, turnId: session.game!.turnId });
    assert.equal(session.game!.phase, 'round-over');
    request(registry, a, 'round.start');
    assert.equal(session.game!.players.length, 2); assert.equal(session.game!.round, 2);
    assert.throws(() => request(registry, c, 'session.join', { playerId: c.id, name: 'C', joinCode: session.joinCode }), /game has started/);
  } finally { registry.dispose(); }
});
test('disconnect preserves host and hand, and reconnect restores the same seat', async () => {
  const { registry, a, b, session } = setup({ botMs: 15 });
  try {
    request(registry, a, 'round.start');
    // This test concerns controller scheduling, not the number of special choices drawn.
    const normalIndex = session.game!.deck.findIndex(card => card.kind === 'standard');
    session.game!.deck.unshift(session.game!.deck.splice(normalIndex, 1)[0]);
    registry.disconnect(a);
    assert.equal(session.host, a.id); assert.equal(session.game!.players[0].controller, 'human');
    const c = new Client(); request(registry, c, 'session.resume', { playerId: a.id, sessionId: session.id });
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(session.game!.turnId, 1); assert.equal(session.game!.players[0].controller, 'human');
    registry.disconnect(c); await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(session.game!.turnId, 1);
  } finally { registry.dispose(); }
});
test('join code collisions retry, sessions are isolated, and idle expiration releases codes', () => {
  let now = 0; const codes = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
  const { registry, a, b, session } = setup({ code: () => codes.shift()!, now: () => now, idleMs: 100 });
  try {
    const c = new Client(); request(registry, c, 'session.create', { playerId: c.id, name: 'C' });
    const other = [...registry.sessionsById.values()][1]; assert.equal(other.joinCode, 'BBBBBB');
    const count = c.messages.length; request(registry, a, 'round.start'); assert.equal(c.messages.length, count);
    registry.disconnect(a); registry.disconnect(b); now = 101; registry.sweep();
    assert.equal(registry.sessionsById.has(session.id), false); assert.equal(registry.activeJoinCodes.has('AAAAAA'), false);
    assert.equal(registry.sessionsById.has(other.id), true);
  } finally { registry.dispose(); }
});
test('disconnected seats survive timeout and round boundaries', () => {
  let now = 0; const { registry, a, b, session } = setup({ reconnectMs: 10, now: () => now });
  try {
    request(registry, a, 'round.start'); request(registry, a, 'player.action', { action: 'quit', round: 1, turnId: 1 });
    registry.disconnect(a); now = 11; registry.sweep(); assert.equal(session.members.size, 2);
    request(registry, b, 'player.action', { action: 'quit', round: 1, turnId: 2 }); assert.equal(session.members.size, 2);
    assert.equal(session.game!.history.length, 1);
  } finally { registry.dispose(); }
});
test('explicit departure cannot reclaim an ongoing seat; malformed requests fail', () => {
  const { registry, a, session } = setup();
  try {
    request(registry, a, 'round.start'); request(registry, a, 'session.leave');
    assert.throws(() => request(registry, new Client(), 'session.resume', { playerId: a.id, sessionId: session.id }), /membership.*ended/);
    assert.throws(() => parseRequest({ type: 'player.action', requestId: 'x', payload: { action: 'hack' } }));
    assert.throws(() => parseRequest({ type: 'session.create', requestId: 'x', payload: { playerId: 'guessable', name: 'A' } }));
  } finally { registry.dispose(); }
});

test('a configured limit above eight works without changing round logic', () => {
  const { registry, a, session } = setup({ maxPlayers: 12 });
  try {
    for (let i = 2; i < 12; i++) {
      const c = new Client(); request(registry, c, 'session.join', { playerId: c.id, name: `Player ${i}`, joinCode: session.joinCode });
    }
    request(registry, a, 'round.start');
    assert.equal(session.game!.players.length, 12); assert.equal(session.game!.deck.length, 55);
    assert.ok(session.game!.players.every(player => player.hand.length === 1 && player.hand[0].kind === 'standard'));
    for (const member of session.members.values()) request(registry, member.peer as Client, 'player.action', { action: 'quit', round: 1, turnId: session.game!.turnId });
    assert.equal(session.game!.phase, 'round-over');
  } finally { registry.dispose(); }
});

test('a late Quit becomes a Hit and reconnect does not extend the turn deadline', () => {
  let now = 0; const { registry, a, session } = setup({ now: () => now });
  try {
    session.config.turnMs = 10000; request(registry, a, 'round.start');
    // A late Quit must draw; choose a normal card so hand-size assertions are deterministic.
    const normalIndex = session.game!.deck.findIndex(card => card.kind === 'standard');
    session.game!.deck.unshift(session.game!.deck.splice(normalIndex, 1)[0]);
    const deadline = session.deadline;
    registry.disconnect(a); now = 5000;
    const c = new Client(); request(registry, c, 'session.resume', { playerId: a.id, sessionId: session.id });
    assert.equal(session.deadline, deadline);
    const before = session.game!.deck.length; now = 10001;
    request(registry, c, 'player.action', { action: 'quit', round: 1, turnId: 1 });
    assert.equal(session.game!.deck.length, before - 1); assert.equal(session.game!.players[0].hand.length, 2);
  } finally { registry.dispose(); }
});

test('host permission, request ID reuse, new game, and sorted public inventory', () => {
  const { registry, a, b, session } = setup();
  try {
    assert.throws(() => request(registry, b, 'round.start'), /Only the host/);
    assert.throws(() => request(registry, b, 'session.configure', { config: { target: 50, turnMs: null } }), /Only the host/);
    request(registry, a, 'session.configure', { config: { target: 50, turnMs: null } });
    assert.equal(session.config.target, 50);
    session.config.target = 1;
    const id = request(registry, a, 'round.start');
    assert.throws(() => request(registry, a, 'session.configure', { config: { target: 30, turnMs: null } }), /before a game/);
    assert.throws(() => request(registry, a, 'session.sync', {}, id), /new request ID/);
    const publicDeck = registry.snapshot(session).game!.deck;
    assert.deepEqual(publicDeck.map(c => c.id), [...publicDeck].sort((a, b) => a.id.localeCompare(b.id)).map(c => c.id));
    request(registry, a, 'player.action', { action: 'quit', round: 1, turnId: 1 });
    request(registry, b, 'player.action', { action: 'quit', round: 1, turnId: 2 });
    assert.equal(session.game!.phase, 'game-over');
    request(registry, a, 'round.start');
    assert.equal(session.game!.phase, 'playing'); assert.equal(session.game!.history.length, 0);
    assert.ok(session.game!.players.every(p => p.total === 0));
  } finally { registry.dispose(); }
});

test('host can end, reconfigure and replay with the same code and members', () => {
  const { registry, a, b, session } = setup();
  try {
    const code = session.joinCode;
    const seats = [...session.members.values()].map(m => m.seatId);
    request(registry, a, 'round.start');
    assert.throws(() => request(registry, b, 'game.end'), /Only the host/);
    assert.throws(() => request(registry, b, 'session.kick', { seatId: seats[0] }), /Only the host/);
    request(registry, a, 'game.end');
    assert.equal(session.game, null); assert.equal(session.timers.length, 0);
    assert.equal((b.messages.at(-1) as any).game, null);
    request(registry, a, 'session.configure', { config: { target: 50, turnMs: 30000, enabledSpecials: [] } });
    request(registry, a, 'round.start');
    assert.equal(session.joinCode, code);
    assert.deepEqual(session.game!.players.map(p => p.id), seats);
    assert.equal(session.game!.config.target, 50);
    assert.equal(session.game!.config.turnMs, 30000);
    assert.equal(session.game!.round, 1);
    assert.ok(session.game!.players.every(p => p.total === 0));
  } finally { registry.dispose(); }
});

test('host removes connected and disconnected players before and during games', () => {
  const { registry, a, b, session } = setup();
  try {
    const bSeat = session.members.get(b.id)!.seatId;
    assert.throws(() => request(registry, a, 'session.kick', { seatId: session.members.get(a.id)!.seatId }), /another player/);
    request(registry, a, 'session.kick', { seatId: bSeat });
    assert.equal(b.closed, true);
    assert.equal(registry.snapshot(session).members.length, 1);
    assert.equal(b.messages.at(-1).code, 'MEMBERSHIP_ENDED');
    const c = new Client(); request(registry, c, 'session.join', { playerId: c.id, name: 'C', joinCode: session.joinCode });
    request(registry, a, 'round.start');
    registry.disconnect(c);
    request(registry, a, 'session.kick', { seatId: session.members.get(c.id)!.seatId });
    assert.equal(registry.snapshot(session).members.length, 1);
    assert.equal(session.game!.players[1].controller, 'bot');
    assert.throws(() => request(registry, new Client(), 'session.resume', { playerId: c.id, sessionId: session.id }), /membership.*ended/);
    request(registry, a, 'game.end');
    assert.equal(session.members.size, 1);
  } finally { registry.dispose(); }
});

test('temporary absence retains seat, score and host across long disconnects', () => {
  let now = 0;
  const { registry, a, b, session } = setup({ now: () => now, reconnectMs: 10 });
  try {
    request(registry, a, 'round.start');
    request(registry, a, 'player.action', { action: 'quit', round: 1, turnId: 1 });
    registry.disconnect(a);
    now = 600000; registry.sweep();
    request(registry, b, 'player.action', { action: 'quit', round: 1, turnId: 2 });
    const before = session.game;
    const restored = new Client(); request(registry, restored, 'session.resume', { playerId: a.id, sessionId: session.id });
    assert.equal(session.host, a.id);
    assert.deepEqual(session.game, before);
    assert.equal(restored.messages[1].game.phase, 'round-over');
  } finally { registry.dispose(); }
});
