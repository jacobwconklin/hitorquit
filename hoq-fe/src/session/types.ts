import type { Card, Command, GameEvent, GameState, GameCard } from '../game/types';
export interface Snapshot<C extends Card = GameCard> {
  game: GameState<C>; deadline: number | null; events: GameEvent[];
  localPlayerId?: string;
  multiplayer?: { isHost: boolean; connected: boolean; joinCode: string; error?: string };
}
export interface GameSession<C extends Card = GameCard> {
  getSnapshot(): Snapshot<C>;
  subscribe(listener: () => void): () => void;
  submit(command: Command): void;
  advanceRound(): void;
  resume(): void;
  dispose(): void;
}
export interface Scheduler { now(): number; schedule(callback: () => void, delay: number): () => void }
