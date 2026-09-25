import type { GameCard, GameEvent, GameState, Player, SpecialId } from '../types';

export type Data = Record<string, any>;
export interface EffectJob { type: 'effect'; special: SpecialId; actorId: string; data: Data }
export interface DrawJob { type: 'draw'; playerId: string; count: number }
export type Job = EffectJob | DrawJob;
export interface ChoiceOption { id: string; label: string; value: string; cardId?: string; playerId?: string }
export interface PendingChoice { id: string; actorId: string; special: SpecialId; prompt: string; options: ChoiceOption[]; job: EffectJob }
export interface Trap { ownerId: string; rank: number }
export interface SpecialState {
  serial: number; queue: Job[]; pending?: PendingChoice; discard: GameCard[];
  dailyDouble: string[]; blinded: { playerId: string; appliedTurn: number }[]; traps: Trap[];
  last?: { special: SpecialId; message: string };
  lastCard?: GameCard;
}
export type FunState = GameState<GameCard>;
export interface EffectContext {
  state: FunState; events: GameEvent[]; random(): number;
  player(id: string): Player<GameCard>;
  active(): Player<GameCard>[];
  say(message: string): void;
  ask(job: EffectJob, actorId: string, prompt: string, options: Omit<ChoiceOption, 'id'>[]): void;
  enqueue(...jobs: Job[]): void;
  draw(playerId: string, count: number): void;
  hitCount(playerId: string): number;
  settle(...ids: string[]): void;
  bank(id: string): void;
  transfer(from: string, to: string, cardId: string): void;
}
export interface SpecialDefinition {
  id: SpecialId; name: string; description: string;
  resolve(ctx: EffectContext, job: EffectJob): void;
}
export const effect = (special: SpecialId, actorId: string, data: Data = {}): EffectJob => ({ type: 'effect', special, actorId, data });
export const playerOptions = (players: Player<GameCard>[]): Omit<ChoiceOption, 'id'>[] => players.map(p => ({ label: p.name, value: p.id, playerId: p.id }));
export const cardOptions = (player: Player<GameCard>): Omit<ChoiceOption, 'id'>[] => player.hand.map((card, i) => ({ label: `Card ${i + 1}`, value: card.id, cardId: card.id }));
