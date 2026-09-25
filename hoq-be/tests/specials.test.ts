import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Sessions, type Peer, type Session } from '../src/sessions';
import { parseRequest } from '../src/protocol';
import type { GameCard, SpecialId } from '../../hoq-fe/src/game/types';

class Client implements Peer {
  id = randomUUID(); messages: any[] = []; closed = false;
  send(message: unknown) { this.messages.push(message); }
  close() { this.closed = true; }
  state() { return this.messages.filter(message => message.type === 'session.state').at(-1); }
}
function request(registry: Sessions, client: Client, type: string, payload: Record<string, unknown> = {}, requestId = randomUUID()) {
  registry.handle(client, parseRequest({ type, payload, requestId }));
  return requestId;
}
const normal = (id: string, rank: number): GameCard => ({ id, kind: 'standard', rank, suit: 'hearts' });
function setup(special: SpecialId, options: ConstructorParameters<typeof Sessions>[0] = {}, timed = false) {
  const registry = new Sessions(options), a = new Client(), b = new Client();
  request(registry, a, 'session.create', { playerId: a.id, name: 'Alice', config: { target: 100, turnMs: timed ? 10000 : null } });
  const session = [...registry.sessionsById.values()][0];
  request(registry, b, 'session.join', { playerId: b.id, name: 'Bob', joinCode: session.joinCode });
  request(registry, a, 'round.start');
  const game = session.game!;
  game.players[0].hand = [normal('a-secret-card', 1)];
  game.players[1].hand = [normal('b-secret-card', 2)];
  game.deck = [{ id: 'special-test', kind: 'special', special }, normal('future-card-three', 3), normal('future-card-four', 4), normal('future-card-five', 5)];
  game.decksAdded = 2;
  request(registry, a, 'player.action', { action: 'hit', round: game.round, turnId: game.turnId });
  return { registry, session, a, b, aSeat: game.players[0].id, bSeat: game.players[1].id };
}
function choice(session: Session, value: string) {
  const pending = session.game!.special!.pending!;
  const option = pending.options.find(option => option.value === value);
  assert.ok(option, `Missing option ${value}`);
  return { action: 'choose', round: session.game!.round, turnId: session.game!.turnId, choiceId: pending.id, optionId: option.id };
}
async function until(check: () => boolean) {
  const end = Date.now() + 2000;
  while (!check()) { if (Date.now() > end) throw new Error('Timed out waiting for bot decision'); await new Promise(resolve => setTimeout(resolve, 5)); }
}

test('Ransom routes the response to the target and validates retries and stale choices without mutation', () => {
  const { registry, session, a, b, aSeat, bSeat } = setup('ransom');
  try {
    const selectTarget = choice(session, bSeat);
    request(registry, a, 'player.action', selectTarget);
    const revision = session.revision;
    assert.throws(() => request(registry, a, 'player.action', selectTarget), /no longer available/);
    assert.equal(session.revision, revision);
    request(registry, a, 'player.action', choice(session, 'b-secret-card'));
    assert.equal(session.game!.players[session.game!.activeIndex].id, aSeat);
    assert.equal(session.game!.special!.pending!.actorId, bSeat);
    assert.equal(a.state().game.special.pending.options.length, 0);
    assert.equal(b.state().game.special.pending.options.length, 2);
    const response = choice(session, 'give');
    const before = JSON.stringify(session.game);
    assert.throws(() => request(registry, a, 'player.action', response), /decision may act/);
    assert.throws(() => request(registry, b, 'player.action', { ...response, optionId: 'option-999' }), /no longer available/);
    assert.throws(() => request(registry, b, 'player.action', { action: 'quit', round: response.round, turnId: response.turnId }), /no longer available/);
    assert.equal(JSON.stringify(session.game), before);
    const requestId = request(registry, b, 'player.action', response);
    const after = JSON.stringify(session.game), acceptedRevision = session.revision;
    request(registry, b, 'player.action', response, requestId);
    assert.equal(JSON.stringify(session.game), after);
    assert.equal(session.revision, acceptedRevision);
    assert.throws(() => request(registry, b, 'player.action', response), /no longer active/);
    assert.deepEqual(session.game!.players[0].hand.map(card => card.id), ['a-secret-card', 'b-secret-card']);
  } finally { registry.dispose(); }
});

test('protocol rejects malformed special choice identifiers before session execution', () => {
  const valid = { action: 'choose', round: 1, turnId: 1, choiceId: 'choice-1', optionId: 'option-0' };
  for (const patch of [
    { choiceId: undefined }, { optionId: undefined }, { choiceId: null }, { optionId: {} },
    { choiceId: 'choice-1234567890123' }, { optionId: 'option-123456' }, { optionId: 'b-secret-card' },
    { round: '1' }, { turnId: 1.5 },
  ]) assert.throws(() => parseRequest({ requestId: randomUUID(), type: 'player.action', payload: { ...valid, ...patch } }));
  assert.equal(parseRequest({ requestId: randomUUID(), type: 'player.action', payload: valid }).type, 'player.action');
});

test('Blindfold redacts every card and score on broadcast, sync, retries, and resume only for its target', () => {
  const { registry, session, a, b, bSeat } = setup('blindfold');
  try {
    request(registry, a, 'player.action', choice(session, bSeat));
    const assertBlind = (client: Client) => {
      const state = client.state(), game = state.game;
      assert.equal(game.informationHidden, true);
      assert.ok(game.players.flatMap((player: any) => player.hand).every((card: any) => card.kind === 'hidden' && Object.keys(card).length === 2));
      assert.ok(game.deck.every((card: any) => card.kind === 'hidden'));
      assert.ok(game.players.every((player: any) => player.total === 0 && player.roundScore === 0));
      assert.deepEqual(game.history, []);
      for (const secret of ['a-secret-card', 'b-secret-card', 'future-card-three', '"rank":', '"suit":']) assert.ok(!JSON.stringify(state).includes(secret));
    };
    assertBlind(b);
    assert.equal(a.state().game.informationHidden, undefined);
    assert.equal(a.state().game.players[0].hand[0].rank, 1);
    const syncId = request(registry, b, 'session.sync'); assertBlind(b);
    request(registry, b, 'session.sync', {}, syncId); assertBlind(b);
    registry.disconnect(b);
    const restored = new Client();
    request(registry, restored, 'session.resume', { playerId: b.id, sessionId: session.id });
    assertBlind(restored);
    assert.equal(session.game!.players[0].hand[0].id, 'a-secret-card');
    request(registry, restored, 'player.action', { action: 'hit', round: session.game!.round, turnId: session.game!.turnId });
    assert.equal(restored.state().game.informationHidden, undefined);
  } finally { registry.dispose(); }
});

test('WAR keeps locked submissions, executable jobs, and choice values out of all peer snapshots', () => {
  const { registry, session, a, b, aSeat, bSeat } = setup('war');
  try {
    request(registry, a, 'player.action', choice(session, 'a-secret-card'));
    assert.equal(session.game!.special!.pending!.job.data.submissions[aSeat], 'a-secret-card');
    assert.equal(session.game!.special!.pending!.actorId, bSeat);
    for (const client of [a, b]) {
      const special = client.state().game.special;
      assert.deepEqual(special.pending.job.data, {});
      assert.deepEqual(special.queue, []);
      assert.deepEqual(special.discard, []);
      assert.ok(!JSON.stringify(special).includes('submissions'));
      assert.ok(special.pending.options.every((option: any) => option.value === ''));
    }
    assert.deepEqual(a.state().game.special.pending.options, []);
    assert.ok(b.state().game.special.pending.options.length > 0);
  } finally { registry.dispose(); }
});

test('Chicken keeps the first commitment secret from the second chooser and spectators', () => {
  const { registry, session, a, b, aSeat, bSeat } = setup('chicken');
  try {
    request(registry, a, 'player.action', choice(session, bSeat));
    request(registry, a, 'player.action', choice(session, 'quit'));
    assert.equal(session.game!.special!.pending!.job.data.choices[aSeat], 'quit');
    assert.equal(session.game!.special!.pending!.actorId, bSeat);
    const spectator = new Client();
    request(registry, spectator, 'session.join', { playerId: spectator.id, name: 'Spectator', joinCode: session.joinCode });
    for (const client of [a, b, spectator]) {
      const pending = client.state().game.special.pending;
      assert.deepEqual(pending.job.data, {});
      assert.ok(!JSON.stringify(pending).includes('"choices"'));
    }
    assert.equal(spectator.state().game.special.pending.options.length, 0);
    assert.equal(b.state().game.special.pending.options.length, 2);
  } finally { registry.dispose(); }
});

test('disconnect schedules the pending decision actor as bot and reconnect preserves its deadline', async () => {
  let now = 0;
  const { registry, session, a, b, bSeat } = setup('ransom', { botMs: 20, now: () => now }, true);
  try {
    request(registry, a, 'player.action', choice(session, bSeat));
    request(registry, a, 'player.action', choice(session, 'b-secret-card'));
    const deadline = session.deadline, pendingId = session.game!.special!.pending!.id;
    now = 5000; registry.disconnect(b);
    assert.equal(session.game!.players[1].controller, 'bot');
    assert.equal(session.game!.players[0].controller, 'human');
    assert.equal(session.deadline, deadline);
    const restored = new Client();
    request(registry, restored, 'session.resume', { playerId: b.id, sessionId: session.id });
    assert.equal(session.deadline, deadline);
    await new Promise(resolve => setTimeout(resolve, 45));
    assert.equal(session.game!.special!.pending!.id, pendingId);
    assert.equal(session.game!.players[1].controller, 'human');
    registry.disconnect(restored);
    await until(() => session.game!.special!.pending?.id !== pendingId);
    assert.ok(session.game!.turnId > 1);
  } finally { registry.dispose(); }
});
