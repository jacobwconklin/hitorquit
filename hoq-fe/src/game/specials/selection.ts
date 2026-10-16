import type { Config, GameCard, SpecialCardId, SpecialId } from '../types';

export const SPECIAL_IDS: SpecialId[] = ['daily-double', 'musical-chairs', 'even-or-odd', 'draw-three', 'steal-card', 'blindfold', 'ransom', 'booby-trap', 'war', 'chicken'];
export const ALL_SPECIAL_CARDS: readonly SpecialCardId[] = [
  ...SPECIAL_IDS, 'blank-spades', 'blank-clubs', 'blank-hearts', 'blank-diamonds', 'rainbow-ace',
];
export function isSpecialSelection(value: unknown): value is SpecialCardId[] {
  return Array.isArray(value) && value.length <= ALL_SPECIAL_CARDS.length &&
    value.every(id => typeof id === 'string' && ALL_SPECIAL_CARDS.includes(id as SpecialCardId)) && new Set(value).size === value.length;
}
export function copyMatchConfig(config: Config): Config {
  if (config.enabledSpecials !== undefined && !isSpecialSelection(config.enabledSpecials)) throw new Error('Invalid special card selection.');
  return { target: config.target, turnMs: config.turnMs, enabledSpecials: [...(config.enabledSpecials ?? ALL_SPECIAL_CARDS)] };
}
export function specialCardId(card: GameCard): SpecialCardId | undefined {
  if (card.kind === 'special') return card.special;
  if (card.kind === 'rainbow') return 'rainbow-ace';
  if (card.kind === 'blank' && card.suit !== 'all') return `blank-${card.suit}`;
  return undefined;
}
