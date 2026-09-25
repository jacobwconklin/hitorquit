import { applyCommand, createGame, nextRound } from '../game/engine';
import type { BotPolicy } from '../game/bots';
import { shuffle } from '../game/standardRules';
import type { Card, Command, Config, GameEvent, Rules, Seat } from '../game/types';
import type { GameSession, Scheduler, Snapshot } from './types';
import { createFunLocalSession } from './funLocalSession';
import type { GameCard } from '../game/types';

const realScheduler: Scheduler = { now: Date.now, schedule: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); } };
export function createLocalSession<C extends Card>(options: {
  seats: Seat[]; config: Config; rules: Rules<C>; bot: BotPolicy<C>; random?: () => number; scheduler?: Scheduler;
}): GameSession<C> {
  if (options.rules.apply) return createFunLocalSession(options as unknown as Parameters<typeof createFunLocalSession>[0]) as unknown as GameSession<C>;
  const { seats, config, rules, bot, random = Math.random, scheduler = realScheduler } = options;
  const freshDeck = () => shuffle(rules.createDeck(), random);
  let snapshot: Snapshot<C> = { game: createGame(seats, config, freshDeck()), deadline: null, events: [] };
  let disposed = false;
  const listeners = new Set<() => void>();
  let cancellations: (() => void)[] = [];
  const cancel = () => { cancellations.forEach(fn => fn()); cancellations = []; };
  const notify = () => listeners.forEach(fn => fn());
  function submit(command: Command) {
    if (disposed) return;
    // An expired turn is always a Hit, including a late Quit arriving before the timer callback.
    const expired = snapshot.deadline !== null && scheduler.now() >= snapshot.deadline;
    const result = applyCommand(snapshot.game, expired ? { ...command, action: 'hit' } : command, rules, random);
    if (result.state === snapshot.game) return;
    snapshot = { game: result.state, deadline: null, events: result.events };
    scheduleTurn(); notify();
  }
  function scheduleTurn() {
    cancel();
    if (disposed || snapshot.game.phase !== 'playing') return;
    const game = snapshot.game;
    const player = game.players[game.activeIndex];
    const command = { playerId: player.id, turnId: game.turnId };
    const turnMs = game.config.turnMs;
    snapshot = { ...snapshot, deadline: turnMs === null ? null : scheduler.now() + turnMs };
    if (turnMs !== null) {
      cancellations.push(scheduler.schedule(() => submit({ ...command, action: 'hit' }), turnMs));
    }
    if (player.controller === 'bot') {
      // Inventory is sorted, so policy never receives the future draw order.
      const remainingCards = [...game.deck].sort((a, b) => a.id.localeCompare(b.id));
      cancellations.push(scheduler.schedule(() => submit({ ...command, action: bot({ player, remainingCards }, random) }), turnMs === null ? 1100 : Math.min(1100, turnMs * 0.6)));
    }
  }
  scheduleTurn();
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    submit,
    advanceRound() {
      if (disposed || snapshot.game.phase !== 'round-over') return;
      const events: GameEvent[] = [{ type: 'round-start', message: 'Fresh deck. New chances.' }];
      snapshot = { game: nextRound(snapshot.game, freshDeck()), deadline: null, events }; scheduleTurn(); notify();
    },
    resume() {
      if (!disposed && snapshot.deadline !== null && scheduler.now() >= snapshot.deadline) {
        const game = snapshot.game;
        submit({ playerId: game.players[game.activeIndex].id, turnId: game.turnId, action: 'hit' });
      }
    },
    dispose() { disposed = true; cancel(); listeners.clear(); },
  };
}
