import type { Rules, StandardCard, Suit } from './types';
export const SUITS: Suit[] = ['spades', 'clubs', 'hearts', 'diamonds'];
export const rankLabel = (rank: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] ?? String(rank);
export const standardRules: Rules<StandardCard> = {
  createDeck: () => SUITS.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 1}`, kind: 'standard' as const, suit, rank: i + 1 }))),
  score(hand) {
    const ranks = new Set(hand.map(c => c.rank));
    if (ranks.has(1)) ranks.add(14);
    const straight = Array.from({ length: 10 }, (_, i) => i + 1).some(start =>
      Array.from({ length: 5 }, (_, i) => start + i).every(rank => ranks.has(rank))) ? 3 : 0;
    const flush = SUITS.some(suit => hand.filter(c => c.suit === suit).length >= 5) ? 3 : 0;
    const seven = hand.length >= 7 ? 5 : 0;
    return { cards: hand.length, flush, straight, seven, total: hand.length + flush + straight + seven };
  },
  resolveDraw(hand, drawn) {
    const next = [...hand, drawn];
    const bust = hand.some(c => c.rank === drawn.rank);
    return { hand: next, bust, bank: false, win: !bust && next.length === 13 };
  },
};
export function shuffle<C>(cards: readonly C[], random: () => number = Math.random): C[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
