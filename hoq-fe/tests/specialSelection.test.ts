import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game/engine';
import { applySpecialCommand, createFunDeck, decisionActor, funRules } from '../src/game/specials/framework';
import { ALL_SPECIAL_CARDS, copyMatchConfig, specialCardId } from '../src/game/specials/selection';
import { specialGuide } from '../src/game/specials/guide';
import type { Config, GameCard, Seat, SpecialCardId } from '../src/game/types';
import { createFunLocalSession } from '../src/session/funLocalSession';

const seats: Seat[] = ['a', 'b'].map(id => ({ id, name: id, controller: 'human' }));
const config = (enabledSpecials?: readonly SpecialCardId[]): Config => ({ target: 50, turnMs: null, enabledSpecials });
function selectedIn(cards: readonly GameCard[]) { return cards.filter(card => card.kind !== 'standard').map(specialCardId).sort(); }

test('default is all, none keeps all 52 standard cards, and every special is independently selectable', () => {
  assert.equal(createFunDeck().length, 67);
  assert.deepEqual(createFunDeck(config(ALL_SPECIAL_CARDS)), createFunDeck());
  const normals = createFunDeck().filter(card => card.kind === 'standard');
  assert.deepEqual(createFunDeck(config([])), normals);
  for (const id of ALL_SPECIAL_CARDS) {
    const deck = createFunDeck(config([id]));
    assert.equal(deck.length, 53);
    assert.deepEqual(deck.filter(card => card.kind === 'standard'), normals);
    assert.deepEqual(selectedIn(deck), [id]);
  }
});

test('all selectable specials have guide entries; WAR reward has no independent deck option', () => {
  assert.deepEqual(specialGuide.map(entry => specialCardId(entry.card)).filter(Boolean).sort(), [...ALL_SPECIAL_CARDS].sort());
  const reward = specialGuide.find(entry => entry.card.kind === 'blank' && entry.card.suit === 'all')!;
  assert.equal(specialCardId(reward.card), undefined);
  assert.ok(!createFunDeck(config(['war'])).some(card => card.kind === 'blank'));
});

test('invalid choices are rejected and normalized match settings own their selection list', () => {
  for (const enabledSpecials of [null, false, 'war', ['unknown'], ['war', 'war'], ['blank-all'], [1]]) {
    assert.throws(() => copyMatchConfig({ ...config(), enabledSpecials } as Config), /Invalid special/);
  }
  const choices: SpecialCardId[] = ['war'];
  const copied = copyMatchConfig(config(choices));
  choices.push('chicken');
  assert.deepEqual(copied.enabledSpecials, ['war']);
  assert.deepEqual(copyMatchConfig(config()).enabledSpecials, ALL_SPECIAL_CARDS);
});

test('the automatically added second deck obeys the same exclusions', () => {
  for (const choices of [[], ['blank-clubs', 'rainbow-ace'], ['war'], [...ALL_SPECIAL_CARDS]] as SpecialCardId[][]) {
    const settings = config(choices);
    const state = createGame(seats, settings, createFunDeck(settings));
    state.deck = state.deck.filter(card => card.kind === 'standard').slice(0, 12);
    const next = applySpecialCommand(state, { playerId: decisionActor(state), round: state.round, turnId: state.turnId, action: 'hit' }, () => 0.999999).state;
    const secondDeck = next.deck.filter(card => card.deckNumber === 2);
    assert.equal(next.decksAdded, 2);
    assert.equal(secondDeck.length, 52 + choices.length);
    assert.deepEqual(selectedIn(secondDeck), [...choices].sort());
    assert.deepEqual(next.config.enabledSpecials, choices);
    assert.equal(state.decksAdded, 1);
  }
});

test('Solo retains selected specials across rounds and ignores later setup-list mutation', () => {
  for (const choices of [[], ['blank-spades', 'rainbow-ace'], [...ALL_SPECIAL_CARDS]] as SpecialCardId[][]) {
    const original = [...choices];
    const session = createFunLocalSession({ seats, config: config(choices), rules: funRules, random: () => 0.999999 });
    try {
      choices.push('chicken');
      for (let round = 1; round <= 3; round++) {
        const game = session.getSnapshot().game;
        assert.equal(game.round, round);
        assert.deepEqual(game.config.enabledSpecials, original);
        assert.deepEqual(selectedIn(game.deck), [...original].sort());
        assert.ok(game.players.every(player => player.hand.length === 1 && player.hand[0].kind === 'standard'));
        for (let turn = 0; turn < seats.length; turn++) {
          const current = session.getSnapshot().game;
          session.submit({ playerId: decisionActor(current), round: current.round, turnId: current.turnId, action: 'quit' });
        }
        assert.equal(session.getSnapshot().game.phase, 'round-over');
        session.advanceRound();
      }
    } finally { session.dispose(); }
  }
});
