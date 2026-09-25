import { createGame, nextRound } from '../game/engine';
import { shuffle } from '../game/standardRules';
import type { Command, Config, GameCard, GameEvent, Rules, Seat } from '../game/types';
import { decisionActor, decisionKey, fallbackCommand, validCommand } from '../game/specials/framework';
import { botCommand, projectEvents, projectGame } from '../game/specials/view';
import type { GameSession, Scheduler, Snapshot } from './types';

export function createFunLocalSession(options: { seats: Seat[]; config: Config; rules: Rules<GameCard>; random?: () => number; scheduler?: Scheduler }): GameSession {
  const random = options.random ?? Math.random;
  const scheduler: Scheduler = options.scheduler ?? { now: Date.now, schedule(fn, ms) { const timer = setTimeout(fn, ms); return () => clearTimeout(timer); } };
  const fresh = () => shuffle(options.rules.createDeck(), random);
  let game = createGame(options.seats, options.config, fresh());
  const viewer = options.seats.find(s => s.controller === 'human')?.id ?? options.seats[0].id;
  let deadline: number | null = null, disposed = false;
  let cancel: (() => void)[] = [];
  const listeners = new Set<() => void>();
  let snapshot: Snapshot;
  function publish(events: GameEvent[] = []) {
    snapshot = { game: projectGame(game, viewer), deadline, events: projectEvents(events, game, viewer), localPlayerId: viewer };
    listeners.forEach(fn => fn());
  }
  function schedule() {
    cancel.forEach(fn => fn()); cancel = []; deadline = null;
    if (disposed || game.phase !== 'playing') return;
    const key = decisionKey(game);
    const run = (fn: () => Command) => { if (!disposed && key === decisionKey(game)) submit(fn()); };
    if (game.config.turnMs !== null) {
      deadline = scheduler.now() + game.config.turnMs;
      cancel.push(scheduler.schedule(() => run(() => fallbackCommand(game)), game.config.turnMs));
    }
    if (game.players.find(p => p.id === decisionActor(game))?.controller === 'bot') cancel.push(scheduler.schedule(() => run(() => botCommand(game, random)), 1100));
  }
  function submit(command: Command) {
    if (disposed || !validCommand(game, command)) return;
    const resolved = deadline !== null && scheduler.now() >= deadline ? fallbackCommand(game) : command;
    const result = options.rules.apply!(game, resolved, random);
    if (result.state === game) return;
    game = result.state; schedule(); publish(result.events);
  }
  schedule(); publish();
  return {
    getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, submit,
    advanceRound() { if (!disposed && game.phase === 'round-over') { game = nextRound(game, fresh()); schedule(); publish([{ type: 'round-start', message: 'One normal card each. New round!' }]); } },
    resume() { if (!disposed && deadline !== null && scheduler.now() >= deadline) submit(fallbackCommand(game)); },
    dispose() { disposed = true; cancel.forEach(fn => fn()); listeners.clear(); },
  };
}
