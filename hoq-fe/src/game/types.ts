export interface Card { id: string; kind: string; deckNumber?: number; rankOverride?: number; suitOverride?: Suit | 'all' }
export type Suit = 'spades' | 'clubs' | 'hearts' | 'diamonds';
export interface StandardCard extends Card { kind: 'standard'; suit: Suit; rank: number }
export type SpecialId = 'daily-double' | 'musical-chairs' | 'even-or-odd' | 'draw-three' | 'steal-card' | 'blindfold' | 'ransom' | 'booby-trap' | 'war' | 'chicken';
export interface SpecialCard extends Card { kind: 'special'; special: SpecialId }
export interface BlankCard extends Card { kind: 'blank'; suit: Suit | 'all' }
export interface RainbowCard extends Card { kind: 'rainbow'; suit: 'all'; rank: 1 }
export interface HiddenCard extends Card { kind: 'hidden' }
export type GameCard = StandardCard | SpecialCard | BlankCard | RainbowCard | HiddenCard;
export type Action = 'hit' | 'quit';
export type PlayerStatus = 'playing' | 'quit' | 'bust';
export interface Seat { id: string; name: string; controller: 'human' | 'bot' }
export interface Player<C extends Card> extends Seat { hand: C[]; status: PlayerStatus; total: number; roundScore: number }
// null means unlimited; keep settings serializable for future session adapters.
export interface Config { target: number; turnMs: number | null }
export interface Score { cards: number; flush: number; straight: number; seven: number; total: number }
export interface RoundResult { round: number; scores: Record<string, number> }
export interface GameState<C extends Card = StandardCard> {
  phase: 'playing' | 'round-over' | 'game-over'; config: Config;
  players: Player<C>[]; deck: C[]; round: number; activeIndex: number;
  turnId: number; history: RoundResult[]; winnerIds: string[]; decksAdded: number;
  special?: import('./specials/contracts').SpecialState;
  informationHidden?: boolean;
}
export interface Rules<C extends Card> {
  createDeck(): C[];
  score(hand: readonly C[]): Score;
  resolveDraw(hand: readonly C[], drawn: C): { hand: C[]; bust: boolean; bank: boolean; win?: boolean };
  apply?: (state: GameState<C>, command: Command, random: () => number) => Transition<C>;
}
export interface Command { playerId: string; turnId: number; action: Action | 'choose'; choiceId?: string; optionId?: string; round?: number }
export interface GameEvent { type: 'hit' | 'quit' | 'bust' | 'bank' | 'round-start' | 'win' | 'bonus' | 'special'; playerId?: string; message: string }
export interface Transition<C extends Card> { state: GameState<C>; events: GameEvent[] }
