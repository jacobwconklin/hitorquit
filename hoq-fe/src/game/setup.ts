import type { Seat } from './types';

export const TURN_OPTIONS = [10, 30, null] as const;
export const BOT_COUNTS = [2, 3, 4, 5, 6, 7] as const;
const BOT_NAMES = ['Ada', 'Beck', 'Cleo', 'Dex', 'Ember', 'Finn', 'Gia'];

export function createLocalSeats(botCount: number): Seat[] {
  if (!Number.isInteger(botCount) || botCount < 2 || botCount > 7) throw new Error('Choose between 2 and 7 bots.');
  return [
    { id: 'you', name: 'You', controller: 'human' },
    ...BOT_NAMES.slice(0, botCount).map(name => ({ id: name.toLowerCase(), name, controller: 'bot' as const })),
  ];
}
