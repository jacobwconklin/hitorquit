import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, createGame, nextRound } from '../src/game/engine';
import { shuffle, standardRules } from '../src/game/standardRules';
import { standardBot } from '../src/game/bots';
import { createLocalSeats } from '../src/game/setup';
import { createLocalSession } from '../src/session/localSession';
import type { Scheduler } from '../src/session/types';
import type { GameState, Seat, StandardCard, Suit } from '../src/game/types';

const seats: Seat[] = [{ id: 'you', name: 'You', controller: 'human' }, { id: 'a', name: 'Ada', controller: 'bot' }, { id: 'b', name: 'Beck', controller: 'bot' }];
const config = { target: 30, turnMs: 5000 };
const card = (rank: number, suit: Suit = 'spades'): StandardCard => ({ id: `${suit}-${rank}`, kind: 'standard', rank, suit });
const act = (state: GameState, action: 'hit' | 'quit') => applyCommand(state, { playerId: state.players[state.activeIndex].id, turnId: state.turnId, action }, standardRules).state;
const hit = (state: GameState) => applyCommand(state, { playerId: state.players[state.activeIndex].id, turnId: state.turnId, action: 'hit' }, standardRules, seeded(42));
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }

test('bonuses announce once and remain at risk beyond seven cards', () => {
  let state = createGame(seats, config, standardRules.createDeck());
  state.players[0].hand = [1, 2, 3, 4].map(r => card(r));
  state.deck = [card(5), ...standardRules.createDeck()];
  let result = hit(state);
  assert.deepEqual(result.events.filter(e => e.type === 'bonus').map(e => e.message), ['+3 Flush · You', '+3 Straight · You']);
  state = { ...result.state, activeIndex: 0, deck: [card(7), ...standardRules.createDeck()] };
  state.players[0].hand = [1, 2, 3, 4, 5, 6].map(r => card(r));
  result = hit(state);
  assert.deepEqual(result.events.filter(e => e.type === 'bonus').map(e => e.message), ['+5 7 cards · You']);
  result = hit({ ...result.state, activeIndex: 0, deck: [card(8), ...standardRules.createDeck()] });
  assert.equal(result.state.players[0].hand.length, 8);
  assert.equal(result.state.players[0].status, 'playing');
  assert.equal(result.events.filter(e => e.type === 'bonus').length, 0);
  result = hit({ ...result.state, activeIndex: 0, deck: [card(8, 'hearts'), ...standardRules.createDeck()] });
  assert.equal(result.state.players[0].status, 'bust');
  assert.equal(result.state.players[0].total, 0);
  assert.equal(result.events.filter(e => e.type === 'bonus').length, 0);
});

test('13 safe cards win immediately even against a higher score; duplicates still bust', () => {
  const state = createGame(seats, { ...config, target: 1000 }, standardRules.createDeck());
  state.players[0].hand = Array.from({ length: 12 }, (_, i) => card(i + 1));
  state.players[1].total = 500;
  state.deck = [card(13), ...standardRules.createDeck()];
  const result = hit(state).state;
  assert.equal(result.phase, 'game-over');
  assert.deepEqual(result.winnerIds, ['you']);
  assert.equal(result.players[0].roundScore, 24);
  assert.equal(result.history.length, 1);
  assert.equal(act(result, 'hit'), result);
  state.deck[0] = card(1, 'hearts');
  assert.equal(hit(state).state.players[0].status, 'bust');
  assert.equal(hit(state).state.phase, 'playing');
});

test('eight players get one second deck below 13; cards stay unique and next round resets', () => {
  let state = createGame(createLocalSeats(7), config, standardRules.createDeck());
  // The ordered deck gives each player distinct ranks until the refill.
  for (let i = 0; i < 31; i++) state = hit(state).state;
  assert.equal(state.deck.length, 13);
  assert.equal(state.decksAdded, 1);
  state = hit(state).state;
  assert.equal(state.deck.length, 64);
  assert.equal(state.decksAdded, 2);
  const cards = [...state.deck, ...state.players.flatMap(p => p.hand)];
  assert.equal(new Set(cards.map(c => c.id)).size, 104);
  assert.equal(cards.filter(c => c.deckNumber === 2).length, 52);
  // Crossing the threshold again never introduces a third deck.
  state.deck = state.deck.slice(0, 13);
  state = hit(state).state;
  assert.equal(state.deck.length, 12);
  assert.equal(state.decksAdded, 2);
  while (state.phase === 'playing') state = act(state, 'quit');
  const fresh = nextRound(state, standardRules.createDeck());
  assert.equal(fresh.decksAdded, 1);
  assert.equal(fresh.deck.length, 44);
});

test('52 unique cards; shuffle preserves the original and reproduces a seed', () => {
  const deck = standardRules.createDeck();
  assert.equal(deck.length, 52); assert.equal(new Set(deck.map(c => c.id)).size, 52);
  assert.deepEqual(shuffle(deck, seeded(42)), shuffle(deck, seeded(42)));
  assert.notDeepEqual(shuffle(deck, seeded(42)), deck);
});
test('scoring: ace-low, ace-high, no wraparound, five-card subsets and stacking once', () => {
  assert.equal(standardRules.score([1, 2, 3, 4, 5].map(r => card(r))).total, 11);
  assert.equal(standardRules.score([10, 11, 12, 13, 1].map(r => card(r))).straight, 3);
  assert.equal(standardRules.score([12, 13, 1, 2, 3].map(r => card(r))).straight, 0);
  assert.deepEqual(standardRules.score([1, 2, 3, 4, 5, 6, 7].map(r => card(r))), { cards: 7, straight: 3, flush: 3, seven: 5, total: 18 });
  assert.equal(standardRules.score([card(1), card(3), card(4), card(6), card(8), card(2, 'hearts')]).flush, 3);
});
test('draw busts on same rank across suits; input state is immutable and stale commands ignored', () => {
  const state = createGame(seats, config, [card(4), card(2), card(3), card(4, 'hearts')]);
  const original = JSON.stringify(state);
  const command = { playerId: 'you', turnId: 1, action: 'hit' as const };
  const next = applyCommand(state, command, standardRules).state;
  assert.equal(next.players[0].status, 'bust'); assert.equal(next.players[0].total, 0);
  assert.equal(next.activeIndex, 1); assert.equal(JSON.stringify(state), original);
  assert.equal(applyCommand(next, command, standardRules).state, next);
  assert.equal(applyCommand(state, { ...command, playerId: 'a' }, standardRules).state, state);
});
test('quit banks, ends rounds once, rotates starter, and ends a tied match after everyone plays', () => {
  let state = createGame(seats, { ...config, target: 2 }, standardRules.createDeck());
  state = act(act(act(state, 'quit'), 'quit'), 'quit');
  assert.equal(state.phase, 'round-over'); assert.equal(state.history.length, 1);
  assert.equal(act(state, 'quit'), state);
  state = nextRound(state, standardRules.createDeck()); assert.equal(state.activeIndex, 1);
  state = act(state, 'quit'); assert.equal(state.phase, 'playing');
  state = act(act(state, 'quit'), 'quit');
  assert.equal(state.phase, 'game-over'); assert.deepEqual(state.winnerIds, ['you', 'a', 'b']);
  assert.equal(state.history.length, 2); assert.equal(nextRound(state, []), state);
});
test('seventh safe card stays playable; duplicate on seventh still busts with zero', () => {
  const state = createGame(seats, config, standardRules.createDeck());
  state.players[0].hand = [1, 2, 3, 4, 5, 6].map(r => card(r));
  state.deck = [card(7)];
  const banked = act(state, 'hit');
  assert.equal(banked.players[0].status, 'playing'); assert.equal(banked.players[0].roundScore, 0);
  state.deck = [card(1, 'hearts')];
  const busted = act(state, 'hit'); assert.equal(busted.players[0].status, 'bust'); assert.equal(busted.players[0].roundScore, 0);
});
test('100 seeded matches finish with card conservation and correct score history', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed);
    let state = createGame(seats, config, shuffle(standardRules.createDeck(), random));
    let turns = 0;
    while (state.phase !== 'game-over' && turns++ < 3000) {
      if (state.phase === 'round-over') state = nextRound(state, shuffle(standardRules.createDeck(), random));
      const player = state.players[state.activeIndex];
      state = act(state, standardBot({ player, remainingCards: state.deck }, random));
      const cards = [...state.deck, ...state.players.flatMap(p => p.hand)];
      assert.equal(cards.length, 52 * state.decksAdded); assert.equal(new Set(cards.map(c => c.id)).size, 52 * state.decksAdded);
    }
    assert.equal(state.phase, 'game-over');
    for (const player of state.players) assert.equal(player.total, state.history.reduce((sum, r) => sum + r.scores[player.id], 0));
  }
});

class Clock implements Scheduler {
  time = 0; id = 0; tasks = new Map<number, { at: number; fn: () => void }>();
  now = () => this.time;
  schedule(fn: () => void, ms: number) { const id = ++this.id; this.tasks.set(id, { at: this.time + ms, fn }); return () => { this.tasks.delete(id); }; }
  advance(ms: number) {
    const target = this.time + ms;
    while (true) {
      const next = [...this.tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      this.time = next[1].at; this.tasks.delete(next[0]); next[1].fn();
    }
    this.time = target;
  }
}
const local = (scheduler: Scheduler) => createLocalSession({ seats, config, rules: standardRules, bot: standardBot, scheduler, random: seeded(123) });
test('timeout hits once; stale human input cannot act for the bot; disposal clears tasks', () => {
  const clock = new Clock(); const session = local(clock);
  clock.advance(5000);
  const snapshot = session.getSnapshot();
  assert.equal(snapshot.game.players[0].hand.length, 2); assert.equal(snapshot.game.turnId, 2);
  session.submit({ playerId: 'you', turnId: 1, action: 'quit' }); assert.equal(session.getSnapshot(), snapshot);
  clock.advance(1100); assert.equal(session.getSnapshot().game.turnId, 3);
  session.dispose(); assert.equal(clock.tasks.size, 0);
  const disposed = session.getSnapshot(); clock.advance(10000); assert.equal(session.getSnapshot(), disposed);
});
test('late quit becomes hit; resume resolves one expired turn with a fresh next deadline', () => {
  const clock = new Clock(); const session = local(clock);
  clock.time = 9000;
  session.submit({ playerId: 'you', turnId: 1, action: 'quit' });
  assert.equal(session.getSnapshot().game.players[0].hand.length, 2);
  assert.equal(session.getSnapshot().deadline, 14000);
  clock.time = 30000; session.resume();
  assert.equal(session.getSnapshot().game.turnId, 3); assert.equal(session.getSnapshot().deadline, 35000);
  session.resume(); assert.equal(session.getSnapshot().game.turnId, 3); session.dispose();
});
test('a complete session runs bots, stops on results and advances only when requested', () => {
  const clock = new Clock(); const session = local(clock);
  for (let turns = 0; turns < 50 && session.getSnapshot().game.phase === 'playing'; turns++) {
    const game = session.getSnapshot().game;
    if (game.players[game.activeIndex].controller === 'human') session.submit({ playerId: 'you', turnId: game.turnId, action: 'quit' });
    else clock.advance(1100);
  }
  assert.equal(session.getSnapshot().game.phase, 'round-over'); assert.equal(clock.tasks.size, 0);
  session.advanceRound(); assert.equal(session.getSnapshot().game.round, 2);
  session.dispose();
});

test('unlimited turns never expire or auto-hit, but bots still play and the next round starts', () => {
  const clock = new Clock();
  const session = createLocalSession({ seats: createLocalSeats(7), config: { ...config, turnMs: null }, rules: standardRules, bot: standardBot, scheduler: clock, random: seeded(123) });
  const initial = session.getSnapshot();
  assert.equal(initial.deadline, null); assert.equal(clock.tasks.size, 0);
  clock.advance(24 * 60 * 60 * 1000); session.resume();
  assert.equal(session.getSnapshot(), initial);
  session.submit({ playerId: 'you', turnId: initial.game.turnId, action: 'quit' });
  assert.equal(session.getSnapshot().game.players[0].status, 'quit');
  assert.equal(clock.tasks.size, 1); // Only the bot decision, no timeout.
  clock.advance(1100); assert.equal(session.getSnapshot().game.turnId, 3);
  clock.advance(60000);
  assert.equal(session.getSnapshot().game.phase, 'round-over');
  assert.equal(session.getSnapshot().deadline, null); assert.equal(clock.tasks.size, 0);
  session.advanceRound();
  assert.equal(session.getSnapshot().game.round, 2); assert.equal(session.getSnapshot().deadline, null);
  assert.equal(clock.tasks.size, 1); session.dispose(); assert.equal(clock.tasks.size, 0);
});

for (const turnMs of [10000, 30000]) {
  test(`${turnMs / 1000}-second turns hit exactly at the deadline`, () => {
    const clock = new Clock();
    const session = createLocalSession({ seats, config: { ...config, turnMs }, rules: standardRules, bot: standardBot, scheduler: clock, random: seeded(123) });
    assert.equal(session.getSnapshot().deadline, turnMs);
    clock.advance(turnMs - 1); assert.equal(session.getSnapshot().game.turnId, 1);
    clock.advance(1); assert.equal(session.getSnapshot().game.turnId, 2);
    assert.equal(session.getSnapshot().game.players[0].hand.length, 2);
    session.dispose();
  });
}

test('all supported bot counts complete matches with unique seats and correct scores', () => {
  for (let bots = 2; bots <= 7; bots++) {
    const players = createLocalSeats(bots);
    assert.equal(players.length, bots + 1);
    assert.equal(players.filter(p => p.controller === 'human').length, 1);
    assert.equal(new Set(players.map(p => p.id)).size, bots + 1);
    const random = seeded(bots);
    let state = createGame(players, { ...config, turnMs: null }, shuffle(standardRules.createDeck(), random));
    for (let turns = 0; turns < 3000 && state.phase !== 'game-over'; turns++) {
      if (state.phase === 'round-over') state = nextRound(state, shuffle(standardRules.createDeck(), random));
      state = act(state, standardBot({ player: state.players[state.activeIndex], remainingCards: state.deck }, random));
      assert.equal(new Set([...state.deck, ...state.players.flatMap(p => p.hand)].map(c => c.id)).size, 52 * state.decksAdded);
    }
    assert.equal(state.phase, 'game-over');
    for (const p of state.players) assert.equal(p.total, state.history.reduce((total, r) => total + r.scores[p.id], 0));
  }
  for (const count of [1, 8, 2.5, NaN]) assert.throws(() => createLocalSeats(count));
});


