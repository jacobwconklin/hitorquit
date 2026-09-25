import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, nextRound } from '../src/game/engine';
import { shuffle } from '../src/game/standardRules';
import type { Command, GameCard, GameEvent, Seat, StandardCard } from '../src/game/types';
import { applySpecialCommand, createFunDeck, decisionActor, emptySpecialState, fallbackCommand, funRules } from '../src/game/specials/framework';
import { botCommand, projectEvents, projectGame } from '../src/game/specials/view';
import type { FunState } from '../src/game/specials/contracts';
import { createFunLocalSession } from '../src/session/funLocalSession';
import type { Scheduler } from '../src/session/types';

const seats: Seat[] = ['a', 'b', 'c'].map(id => ({ id, name: id.toUpperCase(), controller: 'human' }));
const config = { target: 40, turnMs: 5000 };
const card = (rank: number): StandardCard => ({ id: `spades-${rank}`, kind: 'standard', rank, suit: 'spades' });
function seeded(seed: number) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; }; }
const action = (state: FunState, value: 'hit' | 'quit'): Command => ({ playerId: decisionActor(state), turnId: state.turnId, round: state.round, action: value });
const allCards = (state: FunState) => [...state.deck, ...state.players.flatMap(p => p.hand), ...state.special?.discard ?? []];
function customGame(deck: GameCard[]): FunState {
  const state = createGame<GameCard>(seats, config, [card(2), card(3), card(4), ...deck]);
  state.decksAdded = 2; state.special = emptySpecialState(); return state;
}
function choose(state: FunState, value: string): FunState {
  const pending = state.special!.pending!;
  const option = pending.options.find(o => o.value === value)!;
  return applySpecialCommand(state, { ...action(state, 'hit'), action: 'choose', choiceId: pending.id, optionId: option.id }, () => 0.5).state;
}

test('100 seeded full fun matches preserve every physical card, finish, and deal only normal openings', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = seeded(seed);
    const players: Seat[] = Array.from({ length: 3 + seed % 6 }, (_, i) => ({ id: String(i), name: String(i), controller: 'bot' }));
    let state = createGame(players, config, shuffle(createFunDeck(), random));
    let rewards = new Set<string>();
    const opening = () => assert.ok(state.players.every(p => p.hand.length === 1 && p.hand[0].kind === 'standard'), `seed ${seed} round ${state.round}`);
    opening();
    let steps = 0;
    while (state.phase !== 'game-over' && steps++ < 10000) {
      if (state.phase === 'round-over') { state = nextRound(state, shuffle(createFunDeck(), random)); rewards = new Set(); opening(); }
      const before = JSON.stringify(state);
      state = applySpecialCommand(state, botCommand(state, random), random).state;
      assert.notEqual(JSON.stringify(state), before, `seed ${seed}: decision did not advance`);
      const cards = allCards(state);
      cards.filter(c => c.id.startsWith('war-reward-')).forEach(c => rewards.add(c.id));
      const expected = new Set([...createFunDeck().map(c => c.id), ...rewards]);
      if (state.decksAdded === 2) createFunDeck().forEach(c => expected.add(`deck-2:${c.id}`));
      assert.equal(cards.length, expected.size, `seed ${seed} step ${steps}: physical card count`);
      assert.deepEqual(new Set(cards.map(c => c.id)), expected, `seed ${seed} step ${steps}: card identity conservation`);
      for (const p of state.players) {
        const recorded = state.history.reduce((sum, round) => sum + round.scores[p.id], 0);
        assert.equal(p.total, recorded + (state.phase === 'playing' ? p.roundScore : 0), `seed ${seed}: ${p.id} score history`);
      }
    }
    assert.equal(state.phase, 'game-over', `seed ${seed} exceeded decision limit`);
  }
});

test('below thirteen cards replenishes once with a complete 67-card second deck', () => {
  const state = customGame([card(5), ...createFunDeck().filter(c => c.id !== 'spades-5').slice(0, 12)]);
  state.decksAdded = 1;
  const original = JSON.stringify(state);
  let next = applySpecialCommand(state, action(state, 'hit'), () => 0.999999).state;
  assert.equal(JSON.stringify(state), original);
  assert.equal(next.decksAdded, 2); assert.equal(next.deck.length, 79);
  const second = allCards(next).filter(c => c.deckNumber === 2);
  assert.equal(second.length, 67);
  assert.deepEqual(new Set(second.map(c => c.id)), new Set(createFunDeck().map(c => `deck-2:${c.id}`)));
  next.deck = [card(7), ...next.deck.slice(0, 12)];
  next = applySpecialCommand(next, action(next, 'hit'), () => 0.999999).state;
  assert.equal(next.decksAdded, 2); assert.equal(next.deck.length, 12);
});

test('pending WAR and nested draw continuations survive JSON serialization; stale choices do nothing', () => {
  let state = customGame([{ id: 'war', kind: 'special', special: 'war' }, card(8)]);
  state = applySpecialCommand(state, action(state, 'hit'), () => 0.4).state;
  let decisions = 0;
  while (state.special?.pending && decisions++ < 20) {
    const command = fallbackCommand(state);
    const persisted = JSON.parse(JSON.stringify(state));
    const live = applySpecialCommand(state, command, () => 0.4);
    const resumed = applySpecialCommand(persisted, command, () => 0.4);
    assert.deepEqual(resumed, live);
    assert.equal(applySpecialCommand(live.state, command, () => 0.4).state, live.state);
    state = resumed.state;
  }
  assert.equal(decisions, 3); assert.equal(state.special?.pending, undefined);
  assert.ok(allCards(state).some(c => c.id.startsWith('war-reward-')));
  state = customGame([{ id: 'draw-three', kind: 'special', special: 'draw-three' }, { id: 'blindfold', kind: 'special', special: 'blindfold' }, card(8), card(9)]);
  state = applySpecialCommand(state, action(state, 'hit'), () => 0.4).state;
  state = choose(state, 'b');
  assert.equal(state.special!.pending!.special, 'blindfold');
  assert.ok(state.special!.queue.some(job => job.type === 'draw'));
  const command = fallbackCommand(state);
  assert.deepEqual(applySpecialCommand(JSON.parse(JSON.stringify(state)), command, () => 0.4), applySpecialCommand(state, command, () => 0.4));
});

test('viewer projection removes secret commitments, queued effect data, trap ranks, and choice values', () => {
  let state = customGame([{ id: 'war', kind: 'special', special: 'war' }, card(8), card(7)]);
  state.special!.traps.push({ ownerId: 'a', rank: 12 });
  state = applySpecialCommand(state, action(state, 'hit'), () => 0.4).state;
  state = choose(state, 'spades-2');
  assert.equal(state.special!.pending!.actorId, 'b');
  assert.deepEqual(state.special!.pending!.job.data.submissions, { a: 'spades-2' });
  const raw = JSON.stringify(state);
  for (const viewer of ['a', 'b', 'c']) {
    const view = projectGame(state, viewer);
    assert.deepEqual(view.special!.traps, []); assert.deepEqual(view.special!.queue, []); assert.deepEqual(view.special!.discard, []);
    assert.deepEqual(view.special!.pending!.job.data, {});
    assert.ok(view.special!.pending!.options.every(o => o.value === ''));
    if (viewer !== 'b') assert.equal(view.special!.pending!.options.length, 0);
    assert.notDeepEqual(view.deck.map(c => c.id), state.deck.map(c => c.id));
  }
  assert.equal(JSON.stringify(state), raw);
});

test('blind projection masks every card, historical and current score, deck, and card option identity', () => {
  let state = customGame([{ id: 'ransom', kind: 'special', special: 'ransom' }, card(8)]);
  state.players[1].total = 17; state.history = [{ round: 0, scores: { a: 0, b: 17, c: 0 } }];
  state = choose(applySpecialCommand(state, action(state, 'hit'), () => 0.4).state, 'b');
  state.special!.blinded = [{ playerId: 'a', appliedTurn: 0 }];
  const view = projectGame(state, 'a');
  assert.equal(view.informationHidden, true); assert.deepEqual(view.history, []);
  assert.ok([...view.deck, ...view.players.flatMap(p => p.hand)].every(c => c.kind === 'hidden' && !('rank' in c) && !('suit' in c)));
  assert.ok(view.players.every(p => p.total === 0 && p.roundScore === 0));
  assert.ok(view.special!.pending!.options.every(o => !o.cardId?.includes('spades')));
  assert.ok(view.special!.pending!.options.every(o => o.value === ''));
  const events: GameEvent[] = [{ type: 'special', message: 'reveals card rank 7 and score 17' }];
  assert.doesNotMatch(JSON.stringify(projectEvents(events, state, 'a')), /rank 7|score 17/);
  assert.equal(projectGame(state, 'b').informationHidden, undefined);
  assert.equal(projectGame(state, 'b').players[1].total, 17);
});

test('blinded bots make the same decision regardless of concealed ranks or remaining card faces', () => {
  const safe = customGame([card(10), card(11), card(12)]);
  safe.players[0].hand = [card(2), card(3), card(4), card(5)];
  safe.special!.blinded = [{ playerId: 'a', appliedTurn: 0 }];
  const risky: FunState = JSON.parse(JSON.stringify(safe));
  risky.deck = [card(2), card(3), card(4)];
  for (const number of [0, 0.3, 0.8, 0.999]) assert.deepEqual(botCommand(safe, () => number), botCommand(risky, () => number));
  safe.special!.blinded = []; risky.special!.blinded = [];
  assert.equal(botCommand(safe, () => 0.8).action, 'hit'); assert.equal(botCommand(risky, () => 0.8).action, 'quit');
});

class Clock implements Scheduler {
  time = 0; serial = 0; tasks = new Map<number, { at: number; fn: () => void }>();
  now = () => this.time;
  schedule(fn: () => void, ms: number) { const id = ++this.serial; this.tasks.set(id, { at: this.time + ms, fn }); return () => { this.tasks.delete(id); }; }
  advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      const entry = [...this.tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > end) break;
      this.time = entry[1].at; this.tasks.delete(entry[0]); entry[1].fn();
    }
    this.time = end;
  }
}
function timedSession(clock: Clock) {
  const deck = createFunDeck();
  const first = ['spades-2', 'spades-3', 'spades-4', 'special-booby-trap'];
  return createFunLocalSession({ seats, config, scheduler: clock, random: () => 0.999999, rules: { ...funRules,
    createDeck: () => [...first.map(id => deck.find(c => c.id === id)!), ...deck.filter(c => !first.includes(c.id))],
  } });
}

test('fun session times out a pending choice, refreshes each deadline, resumes once, and disposes all timers', () => {
  const clock = new Clock(); const session = timedSession(clock);
  assert.equal(session.getSnapshot().deadline, 5000);
  clock.advance(5000);
  const pending = session.getSnapshot();
  assert.equal(pending.game.special!.pending!.special, 'booby-trap'); assert.equal(pending.deadline, 10000);
  assert.deepEqual(pending.game.special!.pending!.job.data, {});
  clock.advance(5000);
  assert.equal(session.getSnapshot().game.special!.pending, undefined);
  assert.equal(session.getSnapshot().game.turnId, 2); assert.equal(session.getSnapshot().deadline, 15000);
  clock.time = 30000; session.resume();
  const resumed = session.getSnapshot(); assert.equal(resumed.game.turnId, 3); assert.equal(resumed.deadline, 35000);
  session.resume(); assert.equal(session.getSnapshot(), resumed);
  session.dispose(); assert.equal(clock.tasks.size, 0);
  clock.advance(60000); assert.equal(session.getSnapshot(), resumed);
});

test('fun session rejects stale choice tokens and resolves late valid choices using the timeout default', () => {
  const clock = new Clock(); const session = timedSession(clock);
  clock.advance(5000);
  const pending = session.getSnapshot();
  session.submit({ ...action(pending.game, 'hit'), action: 'choose', choiceId: 'stale', optionId: 'option-12' });
  assert.equal(session.getSnapshot(), pending);
  clock.time = 15000;
  session.submit({ ...action(pending.game, 'hit'), action: 'choose', choiceId: pending.game.special!.pending!.id, optionId: 'option-12' });
  assert.equal(session.getSnapshot().game.turnId, 2); assert.equal(session.getSnapshot().deadline, 20000);
  assert.equal(session.getSnapshot().game.special!.pending, undefined);
  session.dispose();
});
