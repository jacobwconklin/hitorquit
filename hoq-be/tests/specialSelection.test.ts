import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Sessions, type Peer } from '../src/sessions';
import { parseRequest, RequestError } from '../src/protocol';
import { ALL_SPECIAL_CARDS, specialCardId } from '../../hoq-fe/src/game/specials/selection';
import type { GameCard, SpecialCardId } from '../../hoq-fe/src/game/types';

class Client implements Peer {
  id = randomUUID(); messages: any[] = [];
  send(message: unknown) { this.messages.push(message); }
  close() {}
  state() { return this.messages.filter(message => message.type === 'session.state').at(-1); }
}
function request(registry: Sessions, peer: Client, type: string, payload = {}, requestId = randomUUID()) {
  registry.handle(peer, parseRequest({ type, payload, requestId })); return requestId;
}
const config = (enabledSpecials?: readonly SpecialCardId[]) => ({ target: 50, turnMs: null, enabledSpecials });
const specials = (cards: GameCard[]) => cards.filter(card => card.kind !== 'standard').map(specialCardId).sort();

test('protocol accepts absent, all, none, and subsets; rejects malformed selections for create and configure', () => {
  for (const type of ['session.create', 'session.configure']) {
    for (const enabledSpecials of [undefined, [], ALL_SPECIAL_CARDS, ['war', 'blank-hearts', 'rainbow-ace']]) {
      assert.doesNotThrow(() => parseRequest({ type, requestId: randomUUID(), payload: { playerId: randomUUID(), name: 'Host', config: { ...config(), enabledSpecials } } }));
    }
    for (const enabledSpecials of [null, true, 'war', {}, ['unknown'], ['war', 'war'], ['blank-all'], [1], Array(16).fill('war')]) {
      assert.throws(() => parseRequest({ type, requestId: randomUUID(), payload: { playerId: randomUUID(), name: 'Host', config: { ...config(), enabledSpecials } } }),
        (error: unknown) => error instanceof RequestError && error.code === 'INVALID_CONFIG');
    }
  }
});

test('host choices broadcast, remain locked during a match, refill correctly, survive rounds and host transfer, and can change for a new game', () => {
  const registry = new Sessions(); const host = new Client(), guest = new Client();
  const enabled: SpecialCardId[] = ['blank-hearts', 'rainbow-ace'];
  try {
    request(registry, host, 'session.create', { playerId: host.id, name: 'Host', config: config(['war']) });
    const session = [...registry.sessionsById.values()][0];
    request(registry, guest, 'session.join', { playerId: guest.id, name: 'Guest', joinCode: session.joinCode });
    assert.deepEqual(guest.state().config.enabledSpecials, ['war']);
    assert.throws(() => request(registry, guest, 'session.configure', { config: config([]) }), (error: unknown) => error instanceof RequestError && error.code === 'NOT_HOST');
    const requestId = request(registry, host, 'session.configure', { config: config(enabled) });
    request(registry, host, 'session.configure', { config: config(enabled) }, requestId);
    assert.deepEqual(guest.state().config.enabledSpecials, enabled);
    request(registry, host, 'round.start');
    assert.deepEqual(specials(session.game!.deck), [...enabled].sort());
    assert.deepEqual(guest.state().game.config.enabledSpecials, enabled);
    assert.throws(() => request(registry, host, 'session.configure', { config: config([]) }), (error: unknown) => error instanceof RequestError && error.code === 'GAME_ACTIVE');
    // Reach the refill threshold with a harmless, nonmatching standard draw.
    const game = session.game!;
    game.players[0].hand = [{ id: 'test-ace', kind: 'standard', rank: 1, suit: 'spades' }];
    game.deck = game.deck.filter(card => card.kind === 'standard' && card.rank !== 1).slice(0, 12);
    request(registry, host, 'player.action', { action: 'hit', round: game.round, turnId: game.turnId });
    assert.equal(session.game!.decksAdded, 2);
    assert.deepEqual(specials(session.game!.deck.filter(card => card.deckNumber === 2)), [...enabled].sort());
    while (session.game!.phase === 'playing') {
      const current = session.game!;
      const actor = current.players[current.activeIndex].id === session.members.get(host.id)!.seatId ? host : guest;
      request(registry, actor, 'player.action', { action: 'quit', round: current.round, turnId: current.turnId });
    }
    assert.throws(() => request(registry, host, 'session.configure', { config: config([]) }), /before a game/);
    registry.disconnect(host);
    assert.equal(session.host, guest.id);
    const restored = new Client();
    request(registry, restored, 'session.resume', { playerId: host.id, sessionId: session.id });
    assert.deepEqual(restored.state().config.enabledSpecials, enabled);
    request(registry, guest, 'round.start');
    assert.equal(session.game!.round, 2);
    assert.deepEqual(specials(session.game!.deck), [...enabled].sort());
    const late = new Client();
    request(registry, late, 'session.join', { playerId: late.id, name: 'Late', joinCode: session.joinCode });
    assert.deepEqual(late.state().config.enabledSpecials, enabled);
    session.game!.phase = 'game-over';
    request(registry, guest, 'session.configure', { config: config([]) });
    assert.deepEqual(session.game!.config.enabledSpecials, enabled, 'new settings must not mutate the completed game');
    request(registry, guest, 'round.start');
    assert.equal(session.game!.deck.length + session.game!.players.length, 52);
    assert.deepEqual(specials(session.game!.deck), []);
  } finally { registry.dispose(); }
});

test('older clients omitting the field still receive a full 67-card deck', () => {
  const registry = new Sessions(); const host = new Client(), guest = new Client();
  try {
    request(registry, host, 'session.create', { playerId: host.id, name: 'Host' });
    const session = [...registry.sessionsById.values()][0];
    request(registry, guest, 'session.join', { playerId: guest.id, name: 'Guest', joinCode: session.joinCode });
    assert.deepEqual(guest.state().config.enabledSpecials, ALL_SPECIAL_CARDS);
    request(registry, host, 'round.start');
    assert.equal(session.game!.deck.length + session.game!.players.length, 67);
  } finally { registry.dispose(); }
});
