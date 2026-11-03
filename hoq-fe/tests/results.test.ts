import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createGame, nextRound } from '../src/game/engine';
import { standardRules } from '../src/game/standardRules';
import { funRules } from '../src/game/specials/framework';
import { projectGame } from '../src/game/specials/view';
import { matchResults } from '../src/game/results';
import type { GameCard, Rules, Seat } from '../src/game/types';
const seats: Seat[] = [{ id: 'a', name: 'Ada', controller: 'human' }, { id: 'b', name: 'Bea', controller: 'human' }];
for (const rules of [standardRules as Rules<GameCard>, funRules]) {
  test(`round-end metrics survive new deals and JSON; reset on replay (${rules.apply ? 'special' : 'standard'})`, () => {
    let state = createGame(seats, { target: 30, turnMs: null, enabledSpecials: [] }, rules.createDeck());
    state.players[0].hand = [{ id: 'a1', kind: 'standard', rank: 1, suit: 'spades' }];
    state.deck.unshift({ id: 'a2', kind: 'standard', rank: 1, suit: 'clubs' });
    state = applyCommand(state, { playerId: 'a', turnId: state.turnId, action: 'hit' }, rules).state;
    state = applyCommand(state, { playerId: 'b', turnId: state.turnId, action: 'quit' }, rules).state;
    assert.equal(state.phase, 'round-over');
    const saved = JSON.parse(JSON.stringify(state.history));
    assert.deepEqual(saved[0].players.a, { name: 'Ada', status: 'bust', cards: 2 });
    state = nextRound(state, rules.createDeck());
    for (let i = 0; i < 2; i++) state = applyCommand(state, { playerId: state.players[state.activeIndex].id, turnId: state.turnId, action: 'quit' }, rules).state;
    assert.deepEqual(state.history[0], saved[0]);
    const results = matchResults(JSON.parse(JSON.stringify(state)));
    assert.equal(results[0].id, 'b');
    assert.equal(results.find(p => p.id === 'a')!.busts, 1);
    assert.equal(results.find(p => p.id === 'a')!.biggestHand, 2);
    assert.equal(results[0].bestRound, 1);
    assert.deepEqual(createGame(seats, state.config, rules.createDeck()).history, []);
    const blind = { ...state, special: { serial: 0, queue: [], discard: [], dailyDouble: [], traps: [], blinded: [{ playerId: 'a', appliedTurn: state.turnId }] } };
    assert.deepEqual(projectGame(blind, 'a').history, []);
  });
}
test('old snapshots show unknown stats, support tied winners, and retain departed players', () => {
  const state = createGame(seats, { target: 1, turnMs: null }, standardRules.createDeck());
  state.winnerIds = ['a', 'b'];
  state.players.forEach(p => p.total = 3);
  state.history = [{ round: 1, scores: { a: 3, b: 3 } }];
  assert.ok(matchResults(state).every(p => p.winner && p.busts === null && p.biggestHand === null && p.bestRound === 3));
  state.history[0].players = { a: { name: 'Ada', status: 'quit', cards: 3 }, b: { name: 'Bea', status: 'quit', cards: 3 } };
  state.players = state.players.filter(p => p.id !== 'b');
  assert.equal(matchResults(state).find(p => p.id === 'b')!.total, 3);
});

test('a smaller closing hand does not erase its earlier peak; new round resets peak', () => {
  let state = createGame(seats, { target: 30, turnMs: null, enabledSpecials: [] }, funRules.createDeck());
  state.players[0].roundMaxHand = 7;
  for (let i = 0; i < 2; i++) state = applyCommand(state, { playerId: state.players[state.activeIndex].id, turnId: state.turnId, action: 'quit' }, funRules).state;
  assert.equal(state.history[0].players!.a.cards, 7);
  assert.equal(matchResults(state).find(p => p.id === 'a')!.biggestHand, 7);
  const next = nextRound(state, funRules.createDeck());
  assert.equal(next.players[0].roundMaxHand, 1);
  assert.equal(next.history[0].players!.a.cards, 7);
});
