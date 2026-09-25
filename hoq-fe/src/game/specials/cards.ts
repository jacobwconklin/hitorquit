import type { GameCard, Score, Suit } from '../types';
import { SUITS } from '../standardRules';
export const faceRank = (card: GameCard): number | null => card.rankOverride ?? (card.kind === 'standard' || card.kind === 'rainbow' ? card.rank : null);
export const faceSuit = (card: GameCard): Suit | 'all' | null => card.suitOverride ?? ('suit' in card ? card.suit : null);
export const hasSuit = (card: GameCard, suit: Suit) => faceSuit(card) === 'all' || faceSuit(card) === suit;
export function scoreCards(hand: readonly GameCard[]): Score {
  const ranks = new Set(hand.map(faceRank).filter((rank): rank is number => rank !== null));
  if (ranks.has(1)) ranks.add(14);
  const straight = Array.from({ length: 10 }, (_, i) => i + 1).some(start => Array.from({ length: 5 }, (_, i) => start + i).every(rank => ranks.has(rank))) ? 3 : 0;
  const flush = SUITS.some(suit => hand.filter(card => hasSuit(card, suit)).length >= 5) ? 3 : 0;
  const cards = hand.filter(c => c.kind !== 'special' && c.kind !== 'hidden').length;
  const seven = cards >= 7 ? 5 : 0;
  return { cards, flush, straight, seven, total: cards + flush + straight + seven };
}
export const isBust = (hand: readonly GameCard[]) => {
  const ranks = hand.map(faceRank).filter(rank => rank !== null);
  return new Set(ranks).size !== ranks.length;
};
