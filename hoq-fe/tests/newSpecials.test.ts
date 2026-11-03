import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, nextRound } from '../src/game/engine';
import { applySpecialCommand, fallbackCommand, validCommand, createFunDeck } from '../src/game/specials/framework';
import { botCommand, projectGame } from '../src/game/specials/view';
import { mustHit } from '../src/game/specials/allIn';
import type { FunState } from '../src/game/specials/contracts';
import type { GameCard, SpecialId } from '../src/game/types';
import { specialGuide } from '../src/game/specials/guide';

const card = (rank: number): GameCard => ({ id: `c-${rank}`, kind: 'standard', rank, suit: 'hearts' });
function setup(special: SpecialId, random = () => 0.5) {
  const state = createGame<GameCard>(['a', 'b'].map(id => ({ id, name: id, controller: 'human' })),
    { target: 1000, turnMs: null }, [card(1), card(2), { id: special, kind: 'special', special }]);
  state.decksAdded = 2;
  return applySpecialCommand(state, fallbackCommand(state), random).state;
}
function choose(state: FunState, value: string) {
  const pending = state.special!.pending!;
  return applySpecialCommand(state, { ...fallbackCommand(state), optionId: pending.options.find(o => o.value === value)!.id }, () => 0.99).state;
}
test('All-in rejects Quit, makes bots Hit, releases at seven and does not reapply after a theft', () => {
  let state = choose(setup('all-in'), 'b');
  const quit = { ...fallbackCommand(state), action: 'quit' as const };
  assert.equal(validCommand(state, quit), false);
  assert.equal(applySpecialCommand(state, quit, Math.random).state, state);
  assert.equal(botCommand(state, () => 0).action, 'hit');
  state.players[1].hand = [2, 3, 4, 5, 6, 7].map(card);
  state.deck = [card(8)];
  state = applySpecialCommand(state, fallbackCommand(state), Math.random).state;
  assert.equal(mustHit(state, 'b'), false);
  state.players[1].hand.pop();
  assert.equal(mustHit(state, 'b'), false);
});
test('All-in handles self, already-seven targets, Chicken, bust, deck exhaustion, and round reset', () => {
  let state = setup('all-in');
  state.players[1].status = 'quit';
  state = choose(state, 'a');
  state.deck = [{ id: 'chicken', kind: 'special', special: 'chicken' }];
  state.players[1].status = 'playing';
  state = applySpecialCommand(state, fallbackCommand(state), Math.random).state;
  state = choose(state, 'b');
  assert.deepEqual(state.special!.pending!.options.map(o => o.value), ['hit']);
  let seven = setup('all-in'); seven.players[1].hand = [1, 2, 3, 4, 5, 6, 7].map(card);
  assert.equal(mustHit(choose(seven, 'b'), 'b'), false);
  for (const deck of [[card(2)], []]) {
    let end = choose(setup('all-in'), 'b'); end.deck = deck;
    end = applySpecialCommand(end, fallbackCommand(end), Math.random).state;
    assert.equal(end.players[1].status, deck.length ? 'bust' : 'quit');
    end.phase = 'round-over';
    assert.equal(mustHit(nextRound(end, createFunDeck()), 'b'), false);
  }
});
test('Mathematical generates four stable suit equations in range, hides results in views, and applies exactly once', () => {
  for (const random of [0, 0.2, 0.5, 0.999999]) {
    let state = setup('mathematical', () => random);
    const pending = state.special!.pending!;
    assert.equal(new Set(pending.job.data.cards.map((c: any) => c.suit)).size, 4);
    pending.options.forEach((o, i) => {
      const numbers = o.label.match(/\d+/g)!.map(Number);
      const rank = numbers[0] * numbers[1] - numbers[2];
      assert.ok(rank >= 1 && rank <= 13);
      assert.equal(rank, pending.job.data.cards[i].rank);
    });
    assert.deepEqual(projectGame(state, 'a').special!.pending!.job.data, {});
    const command = { ...fallbackCommand(state), optionId: pending.options[Math.floor(random * 4)].id };
    state = JSON.parse(JSON.stringify(state));
    const expected = pending.job.data.cards[Math.floor(random * 4)];
    state = applySpecialCommand(state, command, () => { throw Error('Must not regenerate'); }).state;
    assert.deepEqual(state.players[0].hand.at(-1), expected);
    assert.equal(applySpecialCommand(state, command, Math.random).state, state);
  }
});
test('Mathematical duplicate busts and seven-card result releases All-in', () => {
  for (const bust of [true, false]) {
    let state = setup('mathematical');
    const rank = state.special!.pending!.job.data.cards[0].rank;
    state.players[0].hand = bust ? [card(rank)] : [1, 2, 3, 4, 5, 6].map(card);
    state.special!.allIn = ['a'];
    state = choose(state, '0');
    assert.equal(state.players[0].status, bust ? 'bust' : 'playing');
    assert.equal(mustHit(state, 'a'), false);
  }
});
test('slow group cards are the last guide entries and explain their default exclusion', () => {
  assert.deepEqual(specialGuide.slice(-2).map(e => e.name), ['Musical Chairs', 'WAR']);
  specialGuide.slice(-2).forEach(e => assert.match(e.description, /Disabled by default: can slow down large games/));
});
