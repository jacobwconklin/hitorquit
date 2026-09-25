export interface Card { id: string; kind: string; deckNumber?: number }
export type Suit = 'spades' | 'clubs' | 'hearts' | 'diamonds';
export interface StandardCard extends Card { kind: 'standard'; suit: Suit; rank: number }
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
}
export interface Rules<C extends Card> {
  createDeck(): C[];
  score(hand: readonly C[]): Score;
  resolveDraw(hand: readonly C[], drawn: C): { hand: C[]; bust: boolean; bank: boolean; win?: boolean };
}
export interface Command { playerId: string; turnId: number; action: Action }
export interface GameEvent { type: 'hit' | 'quit' | 'bust' | 'bank' | 'round-start' | 'win' | 'bonus'; playerId?: string; message: string }
export interface Transition<C extends Card> { state: GameState<C>; events: GameEvent[] }
