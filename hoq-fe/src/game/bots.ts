import type { Action, Card, Player, StandardCard } from './types';
export interface BotView<C extends Card> { player: Player<C>; remainingCards: readonly C[] }
export type BotPolicy<C extends Card> = (view: BotView<C>, random: () => number) => Action;
export const standardBot: BotPolicy<StandardCard> = ({ player, remainingCards }, random) => {
  const ranks = new Set(player.hand.map(c => c.rank));
  const risk = remainingCards.filter(c => ranks.has(c.rank)).length / Math.max(1, remainingCards.length);
  if (player.hand.length < 3) return 'hit';
  return risk > 0.36 || (player.hand.length >= 4 && random() < 0.6) ? 'quit' : 'hit';
};
