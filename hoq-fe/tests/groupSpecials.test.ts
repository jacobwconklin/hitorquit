import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameCard, SpecialId } from '../src/game/types';
import type { FunState } from '../src/game/specials/contracts';
import { applySpecialCommand, emptySpecialState } from '../src/game/specials/framework';
let serial = 0;
const card = (rank: number): GameCard => ({ kind: 'standard', rank, suit: 'spades', id: `group-card-${++serial}` });
function setup(special: SpecialId, hands: GameCard[][], draws: GameCard[] = []): FunState {
  return {
    phase: 'playing', config: { target: 1000, turnMs: null }, round: 1, activeIndex: 0, turnId: 1, history: [], winnerIds: [], decksAdded: 2,
    special: emptySpecialState(), deck: [{ kind: 'special', special, id: `action-${special}` }, ...draws],
    players: hands.map((hand, i) => ({ id: `p${i}`, name: `Player ${i}`, controller: 'human', hand, status: 'playing', total: 0, roundScore: 0 })),
  };
}
function start(state: FunState): FunState {
  return applySpecialCommand(state, { playerId: 'p0', action: 'hit', turnId: state.turnId }, () => 0).state;
}
function choose(state: FunState, value: string): FunState {
  const pending = state.special!.pending!;
  assert.ok(pending, `Expected pending choice for ${value}`);
  const option = pending.options.find(o => o.value === value);
  assert.ok(option, `Missing choice ${value}: ${pending.options.map(o => o.value)}`);
  return applySpecialCommand(state, { playerId: pending.actorId, action: 'choose', turnId: state.turnId, choiceId: pending.id, optionId: option.id }, () => 0).state;
}
function submitFirstCards(state: FunState): FunState {
  while (state.special!.pending) state = choose(state, state.special!.pending.options[0].value);
  return state;
}

test('Musical Chairs keeps commitments in hand until atomic left transfer, including last cards', () => {
  const cards = [card(2), card(3), card(4)];
  let state = start(setup('musical-chairs', cards.map(c => [c])));
  state = choose(state, 'left');
  state = choose(state, cards[0].id);
  assert.equal(state.players[0].hand[0].id, cards[0].id);
  assert.equal(state.turnId, 1);
  state = choose(state, cards[1].id);
  state = choose(state, cards[2].id);
  assert.deepEqual(state.players.map(p => p.hand[0].id), [cards[2].id, cards[0].id, cards[1].id]);
  assert.equal(state.turnId, 2);
});

test('Musical Chairs right skips finished and empty hands; settles only after whole exchange', () => {
  const a = card(2), b = card(2), c = card(2);
  const original = setup('musical-chairs', [[a], [card(8)], [b], [], [c]]);
  original.players[1].status = 'quit';
  let state = choose(start(original), 'right');
  state = submitFirstCards(state);
  assert.deepEqual([0, 2, 4].map(i => state.players[i].hand[0].id), [b.id, c.id, a.id]);
  assert.ok([0, 2, 4].every(i => state.players[i].status === 'playing'));
  assert.equal(state.players[1].hand[0].id, original.players[1].hand[0].id);
  assert.equal(state.players[3].hand.length, 0);
});

test('Musical Chairs settles a duplicate rank received from another player', () => {
  const original = setup('musical-chairs', [[card(2), card(3)], [card(3), card(4)]]);
  const state = submitFirstCards(choose(start(original), 'left'));
  assert.equal(state.players[0].status, 'bust');
  assert.equal(state.players[1].status, 'playing');
});

test('WAR treats Ace as high, generates all-suit rankless reward, and transfers submitted cards', () => {
  const ace = card(1), king = card(13), two = card(2);
  let state = start(setup('war', [[ace], [king], [two]]));
  state = choose(state, ace.id);
  assert.equal(state.players[0].hand[0].id, ace.id);
  state = choose(state, king.id);
  state = choose(state, two.id);
  assert.deepEqual(state.players[0].hand.map(c => c.kind), ['blank']);
  assert.equal((state.players[0].hand[0] as { suit: string }).suit, 'all');
  assert.equal(state.players[1].hand.length, 0);
  assert.deepEqual(state.players[2].hand.map(c => c.id), [ace.id, king.id, two.id]);
});

test('WAR all-rank ties choose distinct winner and loser; penalty duplicates bust', () => {
  const state = submitFirstCards(start(setup('war', [[card(5)], [card(5)], [card(5)]])));
  assert.equal(state.players[0].hand[0].kind, 'blank');
  assert.equal(state.players[0].status, 'playing');
  assert.equal(state.players[1].status, 'bust');
  assert.equal(state.players[1].hand.length, 3);
});

test('WAR caps the random penalty at three and discards every unused submission', () => {
  const original = setup('war', [[card(1)], [card(2)], [card(3)], [card(4)], [card(5)]]);
  const state = submitFirstCards(start(original));
  assert.equal(state.players[1].hand.length, 3);
  assert.equal(state.special!.discard.filter(c => c.kind === 'standard').length, 2);
  const locations = [...state.players.flatMap(p => p.hand), ...state.special!.discard];
  assert.equal(new Set(locations.map(c => c.id)).size, locations.length);
});

test('WAR accepts rankless submissions if a player has no ranked cards', () => {
  const blank: GameCard = { id: 'only-blank', kind: 'blank', suit: 'hearts' };
  const state = submitFirstCards(start(setup('war', [[blank], [card(8)]])));
  assert.equal(state.players[0].hand.length, 2);
  assert.equal(state.players[1].hand[0].kind, 'blank');
});

test('WAR allows choosing a rankless blank while also holding ranked cards', () => {
  const blank: GameCard = { id: 'chosen-blank', kind: 'blank', suit: 'hearts' };
  let state = start(setup('war', [[card(1), blank], [card(8)]]));
  state = choose(state, blank.id);
  state = submitFirstCards(state);
  assert.equal(state.players[0].hand.length, 3);
  assert.ok(state.players[0].hand.some(c => c.id === blank.id));
  assert.equal(state.players[1].hand[0].kind, 'blank');
});

test('Chicken double Quit banks both without a transfer or extra points', () => {
  let state = choose(start(setup('chicken', [[card(2)], [card(3)], [card(4)]])), 'p1');
  state = choose(state, 'quit');
  assert.equal(state.players[0].status, 'playing');
  state = choose(state, 'quit');
  assert.deepEqual(state.players.slice(0, 2).map(p => [p.status, p.total, p.hand.length]), [['quit', 1, 1], ['quit', 1, 1]]);
  assert.equal(state.activeIndex, 2);
  assert.equal(state.turnId, 2);
});

test('Chicken surviving hitter chooses the theft before quitter banks, allowing an empty hand', () => {
  const gift = card(2);
  let state = choose(start(setup('chicken', [[gift], [card(3)], [card(4)]], [card(5)])), 'p1');
  state = choose(state, 'quit');
  state = choose(state, 'hit');
  assert.equal(state.special!.pending!.actorId, 'p1');
  assert.equal(state.players[0].status, 'playing');
  state = choose(state, gift.id);
  assert.equal(state.players[0].status, 'quit');
  assert.equal(state.players[0].total, 0);
  assert.equal(state.players[1].hand.length, 3);
  assert.equal(state.players[1].status, 'playing');
  assert.equal(state.activeIndex, 1);
});

test('Chicken busted hitter gets no theft and quitter banks the full original hand', () => {
  let state = choose(start(setup('chicken', [[card(2)], [card(3)], [card(4)]], [card(3)])), 'p1');
  state = choose(state, 'quit');
  state = choose(state, 'hit');
  assert.equal(state.players[1].status, 'bust');
  assert.equal(state.players[0].total, 1);
  assert.equal(state.players[0].hand.length, 1);
  assert.equal(state.special!.pending, undefined);
});

test('Chicken theft itself can bust the surviving hitter', () => {
  const gift = card(3);
  let state = choose(start(setup('chicken', [[gift], [card(3)], [card(4)]], [card(5)])), 'p1');
  state = choose(choose(state, 'quit'), 'hit');
  state = choose(state, gift.id);
  assert.equal(state.players[1].status, 'bust');
  assert.equal(state.players[0].status, 'quit');
  assert.equal(state.players[0].total, 0);
});

test('Chicken repeats after both Hits and applies Daily Double in table-seat draw order', () => {
  const draws = [card(5), card(6), card(7)];
  const original = setup('chicken', [[card(2)], [card(3)], [card(4)]], draws);
  original.special!.dailyDouble.push('p0');
  let state = choose(start(original), 'p1');
  state = choose(choose(state, 'hit'), 'hit');
  assert.deepEqual(state.players[0].hand.slice(1).map(c => c.id), draws.slice(0, 2).map(c => c.id));
  assert.equal(state.players[1].hand[1].id, draws[2].id);
  assert.equal(state.special!.pending!.actorId, 'p0');
  state = choose(choose(state, 'quit'), 'quit');
  assert.deepEqual(state.players.slice(0, 2).map(p => p.status), ['quit', 'quit']);
});

test('nested Draw 3 stops drawing for a busted Chicken actor and resumes the other committed Hit', () => {
  const nested: GameCard = { id: 'nested-draw-three', kind: 'special', special: 'draw-three' };
  const safe = card(5), unused = card(6);
  let state = choose(start(setup('chicken', [[card(2)], [card(3)], [card(4)]], [nested, card(2), safe, unused])), 'p1');
  state = choose(choose(state, 'hit'), 'hit');
  assert.equal(state.special!.pending!.special, 'draw-three');
  state = choose(state, 'p0');
  assert.equal(state.players[0].status, 'bust');
  assert.equal(state.players[0].hand.length, 2);
  assert.equal(state.players[1].hand[1].id, safe.id);
  assert.deepEqual(state.deck.map(c => c.id), [unused.id]);
  assert.equal(state.special!.pending, undefined);
  assert.equal(state.special!.queue.length, 0);
  assert.equal(state.turnId, 2);
  assert.equal(state.activeIndex, 1);
});

test('Chicken theft uses the current hand after nested Musical Chairs changes the quitter’s cards', () => {
  const hands = [card(2), card(3), card(4)];
  const nested: GameCard = { id: 'nested-chairs', kind: 'special', special: 'musical-chairs' };
  let state = choose(start(setup('chicken', hands.map(c => [c]), [nested])), 'p1');
  state = choose(choose(state, 'quit'), 'hit');
  state = choose(state, 'left');
  for (const c of hands) state = choose(state, c.id);
  assert.equal(state.special!.pending!.special, 'chicken');
  assert.deepEqual(state.special!.pending!.options.map(o => o.value), [hands[2].id]);
  state = choose(state, hands[2].id);
  assert.equal(state.players[0].status, 'quit');
  assert.equal(state.players[0].total, 0);
  assert.deepEqual(state.players[1].hand.map(c => c.id), [hands[0].id, hands[2].id]);
});

test('nested Chicken banking cancels obsolete outer draws and choices', () => {
  const nested: GameCard = { id: 'nested-chicken', kind: 'special', special: 'chicken' };
  const unused = card(5);
  let state = choose(start(setup('chicken', [[card(2)], [card(3)], [card(4)]], [nested, unused])), 'p1');
  state = choose(choose(state, 'hit'), 'hit');
  state = choose(state, 'p1');
  state = choose(choose(state, 'quit'), 'quit');
  assert.deepEqual(state.players.slice(0, 2).map(p => p.status), ['quit', 'quit']);
  assert.deepEqual(state.deck.map(c => c.id), [unused.id]);
  assert.equal(state.special!.pending, undefined);
  assert.equal(state.special!.queue.length, 0);
  assert.equal(state.turnId, 2);
});

test('Chicken participant reaching thirteen ends the game and clears all continuations exactly once', () => {
  const thirteen = Array.from({ length: 12 }, (_, i) => card(i + 1));
  let state = choose(start(setup('chicken', [[card(2)], thirteen, [card(4)]], [card(13)])), 'p1');
  state = choose(choose(state, 'quit'), 'hit');
  assert.equal(state.phase, 'game-over');
  assert.deepEqual(state.winnerIds, ['p1']);
  assert.equal(state.history.length, 1);
  assert.equal(state.special!.queue.length, 0);
  assert.equal(state.special!.pending, undefined);
  assert.equal(state.turnId, 2);
});
