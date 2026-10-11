import type { GameCard } from '../types';
import { SUITS } from '../standardRules';
import { definitions } from './registry';

export interface SpecialGuideEntry { card: GameCard; name: string; description: string }
// Action explanations share the live game's definitions; passive cards have no effect resolver.
export const specialGuide: SpecialGuideEntry[] = [
  ...Object.values(definitions).map(definition => ({
    card: { id: `guide-${definition.id}`, kind: 'special' as const, special: definition.id },
    name: definition.name, description: definition.description,
  })),
  ...SUITS.map(suit => ({
    card: { id: `guide-blank-${suit}`, kind: 'blank' as const, suit },
    name: `${suit[0].toUpperCase()}${suit.slice(1)} Blank`,
    description: `A rankless ${suit} card. Counts as one card for points and hand-size bonuses and helps a ${suit} flush. It cannot form a rank pair or contribute to a straight.`,
  })),
  { card: { id: 'guide-rainbow', kind: 'rainbow', suit: 'all', rank: 1 }, name: 'Rainbow Ace',
    description: 'An Ace of every suit. Counts as one card and helps any flush or an Ace-low or Ace-high straight. Another Ace makes a pair and busts your hand.' },
  { card: { id: 'guide-all-suit', kind: 'blank', suit: 'all' }, name: 'All-Suit Blank',
    description: 'A reward created for the winner of WAR; it is not in the starting deck. Counts as one card and helps any flush. With no rank, it cannot form a pair or contribute to a straight.' },
];
