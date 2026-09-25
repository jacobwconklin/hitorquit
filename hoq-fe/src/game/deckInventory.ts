import { SUITS } from './standardRules';
import type { StandardCard } from './types';

export const RANKS = Array.from({ length: 13 }, (_, index) => index + 1);

export function getDeckInventory(deck: readonly StandardCard[], decksAdded = Math.max(1, ...deck.map(card => card.deckNumber ?? 1))) {
  const rows = Array.from({ length: decksAdded }, (_, index) => index + 1).flatMap(deckNumber => SUITS.map(suit => ({
    suit, deckNumber,
    counts: RANKS.map(rank => deck.filter(card => (card.deckNumber ?? 1) === deckNumber && card.suit === suit && card.rank === rank).length),
  })));
  return { rows, totals: RANKS.map((_, index) => rows.reduce((total, row) => total + row.counts[index], 0)) };
}
