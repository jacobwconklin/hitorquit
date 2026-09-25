import type { SpecialId } from '../types';
import type { SpecialDefinition } from './contracts';
import { dailyDouble } from './dailyDouble';
import { drawThree } from './drawThree';
import { stealCard } from './stealCard';
import { ransom } from './ransom';
import { musicalChairs } from './musicalChairs';
import { war } from './war';
import { chicken } from './chicken';
import { evenOrOdd } from './evenOrOdd';
import { blindfold } from './blindfold';
import { boobyTrap } from './boobyTrap';
export const definitions: Record<SpecialId, SpecialDefinition> = {
  'daily-double': dailyDouble, 'draw-three': drawThree, 'steal-card': stealCard, ransom,
  'musical-chairs': musicalChairs, war, chicken, 'even-or-odd': evenOrOdd, blindfold, 'booby-trap': boobyTrap,
};
