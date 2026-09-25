import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDeckInventory, RANKS } from '../src/game/deckInventory';
import { standardRules } from '../src/game/standardRules';
import { applyCommand, createGame } from '../src/game/engine';
import { createLocalSeats } from '../src/game/setup';

test('second deck has four separate rows, including when fully dealt', () => {
  const first = standardRules.createDeck();
  const second = first.map(card => ({ ...card, id: `deck-2:${card.id}`, deckNumber: 2 }));
  const inventory = getDeckInventory([...first, ...second], 2);
  assert.equal(inventory.rows.length, 8);
  assert.deepEqual(inventory.totals, Array(13).fill(8));
  assert.ok(inventory.rows.every(row => row.counts.every(count => count === 1)));
  const depleted = getDeckInventory(first, 2);
  assert.ok(depleted.rows.slice(4).every(row => row.counts.every(count => count === 0)));
});

test('inventory shows all thirteen ranks and four suit rows, even when empty', () => {
  assert.deepEqual(RANKS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const full = getDeckInventory(standardRules.createDeck());
  assert.equal(full.rows.length, 4);
  assert.ok(full.rows.every(row => row.counts.length === 13 && row.counts.every(count => count === 1)));
  assert.deepEqual(full.totals, Array(13).fill(4));
  const empty = getDeckInventory([]);
  assert.deepEqual(empty.totals, Array(13).fill(0));
  assert.ok(empty.rows.every(row => row.counts.every(count => count === 0)));
});

test('exhausted ranks keep their columns and suit cells match the remaining cards', () => {
  const deck = standardRules.createDeck().filter(card => card.rank !== 1 && !(card.suit === 'hearts' && card.rank === 13));
  const { rows, totals } = getDeckInventory(deck);
  assert.equal(totals[0], 0);
  assert.equal(totals[12], 3);
  assert.equal(rows.find(row => row.suit === 'hearts')!.counts[12], 0);
  assert.equal(rows.find(row => row.suit === 'spades')!.counts[12], 1);
  assert.equal(totals.reduce((sum, count) => sum + count, 0), deck.length);
});

test('inventory tracks the live draw deck after dealing and hitting without mutating it', () => {
  const game = createGame(createLocalSeats(2), { target: 30, turnMs: null }, standardRules.createDeck());
  const nextCard = game.deck[0];
  const before = getDeckInventory(game.deck);
  const next = applyCommand(game, { playerId: 'you', turnId: game.turnId, action: 'hit' }, standardRules).state;
  const after = getDeckInventory(next.deck);
  assert.equal(after.totals[nextCard.rank - 1], before.totals[nextCard.rank - 1] - 1);
  assert.equal(after.rows.find(row => row.suit === nextCard.suit)!.counts[nextCard.rank - 1], 0);
  assert.equal(after.totals.reduce((sum, count) => sum + count, 0), 48);
  assert.deepEqual(getDeckInventory(game.deck), before);
});
