import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, nextRound } from '../src/game/engine';
import { SUITS } from '../src/game/standardRules';
import type { GameCard, Seat, SpecialId, StandardCard, Suit } from '../src/game/types';
import { applySpecialCommand, createFunDeck, decisionActor, emptySpecialState } from '../src/game/specials/framework';
import type { FunState } from '../src/game/specials/contracts';
import { faceRank, hasSuit, isBust, scoreCards } from '../src/game/specials/cards';

const seats: Seat[] = ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), controller: 'human' }));
const card = (rank: number, suit: Suit = 'spades'): StandardCard => ({ id: `${suit}-${rank}`, kind: 'standard', rank, suit });
const special = (id: SpecialId): GameCard => ({ id, kind: 'special', special: id });
function game(deck: GameCard[] = []): FunState {
  const state = createGame<GameCard>(seats, { target: 1000, turnMs: null }, [card(2), card(3), card(4), ...deck]);
  state.special = emptySpecialState(); state.decksAdded = 2;
  return state;
}
function act(state: FunState, action: 'hit' | 'quit' = 'hit', random = () => 0.4): FunState {
  return applySpecialCommand(state, { playerId: decisionActor(state), turnId: state.turnId, round: state.round, action }, random).state;
}
function choose(state: FunState, value: string, random = () => 0.4): FunState {
  const pending = state.special!.pending!;
  const option = pending.options.find(o => o.value === value);
  assert.ok(option, `Choice ${value} exists for ${pending.prompt}`);
  return applySpecialCommand(state, { playerId: pending.actorId, turnId: state.turnId, round: state.round, action: 'choose', choiceId: pending.id, optionId: option.id }, random).state;
}

test('each fun deck contains one of every selected special, all four suit blanks, and Rainbow Ace', () => {
  const deck = createFunDeck();
  assert.equal(deck.length, 67);
  assert.equal(new Set(deck.map(c => c.id)).size, 67);
  assert.equal(deck.filter(c => c.kind === 'standard').length, 52);
  const expected: SpecialId[] = ['daily-double', 'musical-chairs', 'even-or-odd', 'draw-three', 'steal-card', 'blindfold', 'ransom', 'booby-trap', 'war', 'chicken'];
  for (const id of expected) assert.equal(deck.filter(c => c.kind === 'special' && c.special === id).length, 1);
  for (const suit of SUITS) assert.equal(deck.filter(c => c.kind === 'blank' && c.suit === suit).length, 1);
  assert.equal(deck.filter(c => c.kind === 'rainbow').length, 1);
});

test('blanks score one card and their suit, with no rank, straight contribution, or duplicate bust', () => {
  const blanks = createFunDeck().filter(c => c.kind === 'blank');
  assert.deepEqual(scoreCards(blanks), { cards: 4, flush: 0, straight: 0, seven: 0, total: 4 });
  assert.ok(blanks.every(c => faceRank(c) === null));
  const spades = blanks.find(c => c.kind === 'blank' && c.suit === 'spades')!;
  const hand = [card(2), card(3), card(4), card(5), spades];
  assert.equal(scoreCards(hand).flush, 3); assert.equal(scoreCards(hand).straight, 0);
  assert.equal(isBust([...hand, { ...spades, id: 'second-blank' }]), false);
  const warReward: GameCard = { id: 'war-reward', kind: 'blank', suit: 'all' };
  assert.ok(SUITS.every(suit => hasSuit(warReward, suit)));
  assert.equal(scoreCards([warReward]).cards, 1); assert.equal(faceRank(warReward), null);
});

test('Rainbow Ace has every suit but one card, counts as an Ace in either straight, and busts with another Ace', () => {
  const rainbow = createFunDeck().find(c => c.kind === 'rainbow')!;
  assert.ok(SUITS.every(suit => hasSuit(rainbow, suit)));
  assert.equal(scoreCards([rainbow]).total, 1);
  for (const suit of SUITS) {
    assert.equal(scoreCards([rainbow, ...[2, 3, 4, 5].map(rank => card(rank, suit))]).total, 11);
    assert.equal(scoreCards([rainbow, ...[10, 11, 12, 13].map(rank => card(rank, suit))]).straight, 3);
  }
  assert.equal(isBust([rainbow, card(1, 'hearts')]), true);
  assert.equal(isBust([rainbow, { ...rainbow, id: 'second-rainbow' }]), true);
});

test('Even or Odd lets drawer choose self or another active player, then only target chooses parity and winning suit', () => {
  let state = game([special('even-or-odd')]);
  state.players[1].hand = [2, 4, 6, 8, 10].map((rank, i) => card(rank, SUITS[i % 4]));
  state.players[2].status = 'quit';
  state = act(state);
  assert.deepEqual(state.special!.pending!.options.map(o => o.value), ['a', 'b']);
  state = choose(state, 'b'); assert.equal(decisionActor(state), 'b');
  state = choose(state, 'even', () => 0); // Zero is even.
  assert.equal(decisionActor(state), 'b'); assert.match(state.special!.pending!.prompt, /rolled 0/);
  state = choose(state, 'hearts');
  assert.ok(state.players[1].hand.every(c => c.suitOverride === 'hearts'));
  assert.equal(scoreCards(state.players[1].hand).flush, 3);
  assert.equal(state.players[0].hand[0].suitOverride, undefined);
  assert.equal(state.special!.pending, undefined); assert.equal(state.turnId, 2);
});

test('Even or Odd wrong guess busts multiple cards but does not fabricate a duplicate for one card', () => {
  let state = game([special('even-or-odd')]);
  state.players[1].hand.push(card(9));
  state = choose(choose(act(state), 'b'), 'even', () => 0.9);
  assert.equal(state.players[1].status, 'bust'); assert.equal(state.players[1].roundScore, 0);
  assert.ok(state.players[1].hand.every(c => faceRank(c) === 1));
  state = game([special('even-or-odd')]);
  state = choose(choose(act(state), 'a'), 'odd', () => 0.2);
  assert.equal(state.players[0].status, 'playing'); assert.equal(faceRank(state.players[0].hand[0]), 1);
});

test('Blindfold only targets opponents still playing and clears after the entire next personal turn', () => {
  let state = game([special('blindfold'), special('even-or-odd')]);
  state.players[2].status = 'quit';
  state = act(state);
  assert.deepEqual(state.special!.pending!.options.map(o => o.value), ['b']);
  state = choose(state, 'b');
  assert.deepEqual(state.special!.blinded, [{ playerId: 'b', appliedTurn: 1 }]);
  state = act(state); // B draws a special; its interactive choices are still blind.
  assert.equal(state.special!.blinded.length, 1);
  state = choose(choose(state, 'b'), 'even');
  assert.equal(state.special!.blinded.length, 1);
  state = choose(state, 'clubs');
  assert.deepEqual(state.special!.blinded, []);
});

test('repeated Blindfold refreshes a single status and quit immediately removes it', () => {
  let state = game([special('blindfold')]);
  state.special!.blinded.push({ playerId: 'b', appliedTurn: 0 });
  state = choose(act(state), 'b');
  assert.deepEqual(state.special!.blinded, [{ playerId: 'b', appliedTurn: 1 }]);
  state = act(state, 'quit');
  assert.deepEqual(state.special!.blinded, []);
});

test('Booby Trap privately chooses a rank and triggers once on an opponent surviving an actual draw', () => {
  let state = game([special('booby-trap'), card(7), card(8), card(7, 'hearts')]);
  state = choose(act(state), '7');
  assert.deepEqual(state.special!.traps, [{ ownerId: 'a', rank: 7 }]);
  assert.doesNotMatch(state.special!.last!.message, /7/);
  state = act(state);
  assert.deepEqual(state.players[1].hand.map(faceRank), [3, 7, 8]);
  assert.deepEqual(state.special!.traps, []);
  state = act(state); assert.equal(state.players[2].hand.length, 2);
});

test('Booby Trap skips its owner and terminal bust draws, and multiple matching traps each add a draw', () => {
  let state = game([card(7)]);
  state.special!.traps = [{ ownerId: 'a', rank: 7 }];
  state = act(state); assert.equal(state.special!.traps.length, 1); assert.equal(state.players[0].hand.length, 2);
  state = game([card(2, 'hearts'), card(8)]);
  state.special!.traps = [{ ownerId: 'b', rank: 2 }];
  state = act(state); assert.equal(state.players[0].status, 'bust'); assert.equal(state.special!.traps.length, 1); assert.equal(state.deck.length, 1);
  state = game([card(7), card(8), card(9)]);
  state.special!.traps = [{ ownerId: 'b', rank: 7 }, { ownerId: 'c', rank: 7 }];
  state = act(state); assert.deepEqual(state.players[0].hand.map(faceRank), [2, 7, 8, 9]); assert.equal(state.special!.traps.length, 0);
});

test('traps persist between rounds without triggering on normal opening cards', () => {
  let state = game();
  state.special!.traps = [{ ownerId: 'a', rank: 3 }];
  state = act(act(act(state, 'quit'), 'quit'), 'quit');
  state = nextRound(state, [special('booby-trap'), card(2), card(3), card(4), card(8)]);
  assert.deepEqual(state.players.map(p => p.hand.map(faceRank)), [[2], [3], [4]]);
  assert.deepEqual(state.special!.traps, [{ ownerId: 'a', rank: 3 }]);
  assert.deepEqual(state.deck.map(c => c.id), ['booby-trap', 'spades-8']);
});
