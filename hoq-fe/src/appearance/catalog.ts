export const frontSets = [
  { id: 'default', name: 'Default' }, { id: 'elements', name: 'Elements' },
  { id: 'flowers', name: 'Flowers' }, { id: 'swords', name: 'Swords' }, { id: 'tetra', name: 'Tetra' },
] as const;
export const backs = [
  { id: 'triangle', name: 'Triangle' }, { id: 'blocks', name: 'Blocks' },
  { id: 'blue-diamonds', name: 'Blue Diamonds' }, { id: 'celestial', name: 'Celestial' },
  { id: 'houndstooth', name: 'Houndstooth' }, { id: 'purple-diamonds', name: 'Purple Diamonds' },
  { id: 'red-diamonds', name: 'Red Diamonds' }, { id: 'web', name: 'Web' },
] as const;
export const fonts = [
  { id: 'classic', name: 'Classic' }, { id: 'chakra-petch', name: 'Chakra Petch' },
  { id: 'doto', name: 'Doto' }, { id: 'galada', name: 'Galada' },
  { id: 'major-mono-display', name: 'Major Mono Display' }, { id: 'mea-culpa', name: 'Mea Culpa' },
  { id: 'mystery-quest', name: 'Mystery Quest' }, { id: 'nixie-one', name: 'Nixie One' },
  { id: 'rampart-one', name: 'Rampart One' }, { id: 'ribeye-marrow', name: 'Ribeye Marrow' },
  { id: 'rye', name: 'Rye' }, { id: 'silkscreen', name: 'Silkscreen' }, { id: 'sofia', name: 'Sofia' },
] as const;
export type FrontSetId = typeof frontSets[number]['id'];
export type BackId = typeof backs[number]['id'];
export type FontId = typeof fonts[number]['id'];
export interface AppearancePreferences { version: 1; frontSetId: FrontSetId; backId: BackId; fontId: FontId }
export const defaults: AppearancePreferences = { version: 1, frontSetId: 'default', backId: 'triangle', fontId: 'classic' };
export const fontFamily = (id: FontId) => `HOQ-${id}`;
export function validatePreferences(value: unknown): AppearancePreferences {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return { ...defaults };
  const record = value as Record<string, unknown>;
  return {
    version: 1,
    frontSetId: frontSets.find(option => option.id === record.frontSetId)?.id ?? defaults.frontSetId,
    backId: backs.find(option => option.id === record.backId)?.id ?? defaults.backId,
    fontId: fonts.find(option => option.id === record.fontId)?.id ?? defaults.fontId,
  };
}
