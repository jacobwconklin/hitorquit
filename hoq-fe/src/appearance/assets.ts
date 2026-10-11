import type { ImageSourcePropType } from 'react-native';
import type { FontSource } from 'expo-font';
import type { Suit } from '../game/types';
import type { FrontSetId, BackId, FontId } from './catalog';

export const frontAssets: Record<FrontSetId, Record<Suit, ImageSourcePropType>> = {
  default: {
    spades: require('../../game-art/card-fronts/default/blue.png'), clubs: require('../../game-art/card-fronts/default/green.png'),
    hearts: require('../../game-art/card-fronts/default/red.png'), diamonds: require('../../game-art/card-fronts/default/yellow.png'),
  },
  elements: {
    spades: require('../../game-art/card-fronts/elements/blue.png'), clubs: require('../../game-art/card-fronts/elements/green.png'),
    hearts: require('../../game-art/card-fronts/elements/red.png'), diamonds: require('../../game-art/card-fronts/elements/yellow.png'),
  },
  flowers: {
    spades: require('../../game-art/card-fronts/flowers/blue-small-flower.png'), clubs: require('../../game-art/card-fronts/flowers/green-small-flower.png'),
    hearts: require('../../game-art/card-fronts/flowers/red-small-flower.png'), diamonds: require('../../game-art/card-fronts/flowers/yellow-small-flower.png'),
  },
  swords: {
    spades: require('../../game-art/card-fronts/swords/blue.png'), clubs: require('../../game-art/card-fronts/swords/green.png'),
    hearts: require('../../game-art/card-fronts/swords/red.png'), diamonds: require('../../game-art/card-fronts/swords/yellow.png'),
  },
  tetra: {
    spades: require('../../game-art/card-fronts/tetra/blue.png'), clubs: require('../../game-art/card-fronts/tetra/green.png'),
    hearts: require('../../game-art/card-fronts/tetra/red.png'), diamonds: require('../../game-art/card-fronts/tetra/yellow.png'),
  },
};
export const backAssets: Record<BackId, ImageSourcePropType> = {
  triangle: require('../../game-art/card-backs/triangle.png'), blocks: require('../../game-art/card-backs/blocks.png'),
  'blue-diamonds': require('../../game-art/card-backs/blue-diamonds.png'), celestial: require('../../game-art/card-backs/celestial.png'),
  houndstooth: require('../../game-art/card-backs/houndstooth.png'), 'purple-diamonds': require('../../game-art/card-backs/purple-diamonds.png'),
  'red-diamonds': require('../../game-art/card-backs/red-diamonds.png'), web: require('../../game-art/card-backs/web.png'),
};
export const fontAssets: Record<FontId, FontSource> = {
  classic: require('../../game-art/fonts/Classic.ttf'), 'chakra-petch': require('../../game-art/fonts/ChakraPetch-Regular.ttf'),
  doto: require('../../game-art/fonts/Doto-Regular.ttf'), galada: require('../../game-art/fonts/Galada-Regular.ttf'),
  'major-mono-display': require('../../game-art/fonts/MajorMonoDisplay-Regular.ttf'), 'mea-culpa': require('../../game-art/fonts/MeaCulpa-Regular.ttf'),
  'mystery-quest': require('../../game-art/fonts/MysteryQuest-Regular.ttf'), 'nixie-one': require('../../game-art/fonts/NixieOne-Regular.ttf'),
  'rampart-one': require('../../game-art/fonts/RampartOne-Regular.ttf'), 'ribeye-marrow': require('../../game-art/fonts/RibeyeMarrow-Regular.ttf'),
  rye: require('../../game-art/fonts/Rye-Regular.ttf'), silkscreen: require('../../game-art/fonts/Silkscreen-Regular.ttf'),
  sofia: require('../../game-art/fonts/Sofia-Regular.ttf'),
};
