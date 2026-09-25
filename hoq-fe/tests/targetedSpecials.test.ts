import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createGame } from '../src/game/engine';
import { funRules } from '../src/game/specials/framework';
import type { FunState } from '../src/game/specials/contracts';
import type { GameCard, SpecialId } from '../src/game/types';

const normal = (id: string, rank: number): GameCard => ({ id, kind: 'standard', rank, suit: 'hearts' });
function setup(special: SpecialId, tail: GameCard[] = []): FunState {
  const state = createGame<GameCard>([
    { id: 'a', name: 'Alice', controller: 'human' },
    { id: 'b', name: 'Bob', controller: 'human' },
  ], { target: 100, turnMs: null }, [normal('a-start', 1), normal('b-start', 2),
    { id: `special-${special}`, kind: 'special', special }, ...tail]);
  state.decksAdded = 2; // A deterministic, already-replenished deck.
  return state;
}
const hit = (state: FunState, playerId = 'a') => applyCommand(state,
  { playerId, turnId: state.turnId, round: state.round, action: 'hit' }, funRules, () => 0.5).state;
function choose(state: FunState, value: string): FunState {
  // Choices must survive transport and reconnect without retaining closures.
  state = JSON.parse(JSON.stringify(state));
  const pending = state.special?.pending;
  assert.ok(pending);
  const option = pending.options.find(option => option.value === value);
  assert.ok(option, `Missing choice ${value}`);
  return applyCommand(state, { playerId: pending.actorId, turnId: state.turnId, round: state.round,
    action: 'choose', choiceId: pending.id, optionId: option.id }, funRules, () => 0.5).state;
}

test('Daily Double includes self, is idempotent, and changes subsequent Hits to two draws', () => {
  let state = hit(setup('daily-double', [normal('three', 3), normal('four', 4)]));
  assert.deepEqual(state.special!.pending!.options.map(o => o.value), ['a', 'b']);
  state.special!.dailyDouble = ['a'];
  state = choose(state, 'a');
  assert.deepEqual(state.special!.dailyDouble, ['a']);
  assert.equal(state.players[0].hand.length, 1);
  state = applyCommand(state, { playerId: 'b', turnId: state.turnId, action: 'quit' }, funRules).state;
  state = hit(state);
  assert.deepEqual(state.players[0].hand.map(c => c.id), ['a-start', 'three', 'four']);
});

test('Draw 3 resolves exactly three draws, even when the target has Daily Double', () => {
  let state = hit(setup('draw-three', [normal('three', 3), normal('four', 4), normal('five', 5), normal('six', 6)]));
  state.special!.dailyDouble = ['a'];
  state = choose(state, 'a');
  assert.equal(state.players[0].hand.length, 4);
  assert.deepEqual(state.deck.map(c => c.id), ['six']);
  assert.equal(state.special!.pending, undefined);
  assert.equal(state.activeIndex, 1);
});

test('Draw 3 stops immediately on bust and preserves the undrawn cards', () => {
  let state = hit(setup('draw-three', [normal('duplicate', 2), normal('four', 4), normal('five', 5)]));
  state = choose(state, 'b');
  assert.equal(state.players[1].status, 'bust');
  assert.deepEqual(state.deck.map(c => c.id), ['four', 'five']);
  assert.deepEqual(state.special!.queue, []);
});

test('Draw 3 resumes its remaining draws after a nested special decision', () => {
  let state = hit(setup('draw-three', [
    { id: 'nested', kind: 'special', special: 'daily-double' }, normal('four', 4), normal('five', 5), normal('six', 6),
  ]));
  state = choose(state, 'b');
  assert.equal(state.special!.pending!.actorId, 'b');
  assert.equal(state.special!.pending!.special, 'daily-double');
  state = choose(state, 'b');
  assert.deepEqual(state.players[1].hand.map(c => c.id), ['b-start', 'four', 'five']);
  assert.deepEqual(state.deck.map(c => c.id), ['six']);
});

test('Steal Card moves the chosen card, permits the last card, and settles an immediate bust', () => {
  let state = setup('steal-card');
  state.players[1].hand = [normal('duplicate', 1)];
  state = hit(state);
  assert.deepEqual(state.special!.pending!.options.map(o => o.value), ['b']);
  state = choose(state, 'b');
  state = choose(state, 'duplicate');
  assert.deepEqual(state.players[1].hand, []);
  assert.deepEqual(state.players[0].hand.map(c => c.id), ['a-start', 'duplicate']);
  assert.equal(state.players[0].status, 'bust');
});

test('Steal Card excludes finished opponents and fizzles when nobody is eligible', () => {
  let state = setup('steal-card', [normal('three', 3)]);
  state.players[1].status = 'quit';
  state = hit(state);
  assert.equal(state.special!.pending, undefined);
  assert.equal(state.players[0].hand.length, 1);
  assert.equal(state.deck.length, 1);
});

test('Ransom lets the attacker select the exact demanded card and gives the target the response', () => {
  let state = setup('ransom');
  state.players[1].hand.push(normal('three', 3));
  state = choose(choose(hit(state), 'b'), 'three');
  assert.equal(state.special!.pending!.actorId, 'b');
  assert.equal(state.special!.pending!.options[0].cardId, 'three');
  const pending = state.special!.pending!;
  const rejected = applyCommand(state, { playerId: 'a', turnId: state.turnId, action: 'choose',
    choiceId: pending.id, optionId: pending.options[0].id }, funRules).state;
  assert.equal(rejected, state);
  state = choose(state, 'give');
  assert.deepEqual(state.players[0].hand.map(c => c.id), ['a-start', 'three']);
  assert.deepEqual(state.players[1].hand.map(c => c.id), ['b-start']);
});

test('Ransom refusal respects Daily Double and preserves the demanded card', () => {
  let state = choose(choose(hit(setup('ransom', [normal('three', 3), normal('four', 4), normal('five', 5)])), 'b'), 'b-start');
  state.special!.dailyDouble = ['b'];
  state = choose(state, 'hit');
  assert.deepEqual(state.players[1].hand.map(c => c.id), ['b-start', 'three', 'four']);
  assert.deepEqual(state.players[0].hand.map(c => c.id), ['a-start']);
  assert.deepEqual(state.deck.map(c => c.id), ['five']);
  assert.equal(state.activeIndex, 1);
});
