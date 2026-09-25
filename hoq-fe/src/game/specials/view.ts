import type { Command, GameCard, GameEvent, GameState } from '../types';
import { faceRank } from './cards';
import { decisionActor, fallbackCommand } from './framework';

export function projectGame(state: GameState<GameCard>, viewerId: string): GameState<GameCard> {
  const view: GameState<GameCard> = JSON.parse(JSON.stringify(state));
  const blind = state.special?.blinded.some(b => b.playerId === viewerId) ?? false;
  const handles = new Map<string, string>();
  for (const player of view.players) {
    if (blind) {
      player.hand = player.hand.map((card, i) => { const id = `hidden-${player.id}-${i}`; handles.set(card.id, id); return { id, kind: 'hidden' }; });
      player.total = 0; player.roundScore = 0;
    }
  }
  view.deck = blind ? view.deck.map((_, i) => ({ id: `hidden-deck-${i}`, kind: 'hidden' })) : view.deck.sort((a, b) => a.id.localeCompare(b.id));
  if (blind) { view.history = []; view.informationHidden = true; }
  if (view.special) {
    const s = view.special;
    s.queue = []; s.discard = []; s.traps = [];
    if (s.pending) {
      const pending = s.pending;
      pending.job = { type: 'effect', actorId: pending.actorId, special: pending.special, data: {} };
      if (pending.actorId !== viewerId) { pending.options = []; pending.prompt = 'Waiting for a player to choose.'; }
      else pending.options = pending.options.map(option => ({ ...option, value: '', cardId: blind && option.cardId ? handles.get(option.cardId) : option.cardId }));
    }
    if (blind && s.last) s.last.message = 'You are blinded until your next turn ends.';
    if (blind && s.lastCard) s.lastCard = { id: 'hidden-reveal', kind: 'hidden' };
  }
  return view;
}
export function projectEvents(events: GameEvent[], state: GameState<GameCard>, viewerId: string): GameEvent[] {
  return state.special?.blinded.some(b => b.playerId === viewerId)
    ? events.length ? [{ type: 'special', message: 'Cards are hidden while you are blinded.' }] : [] : events;
}
export function botCommand(state: GameState<GameCard>, random: () => number): Command {
  const view = projectGame(state, decisionActor(state));
  const command = fallbackCommand(state);
  if (view.special?.pending) {
    const options = view.special.pending.options;
    return { ...command, optionId: options[Math.floor(random() * options.length)]?.id };
  }
  const player = view.players.find(p => p.id === command.playerId)!;
  const ranks = new Set(player.hand.map(faceRank).filter(r => r !== null));
  const risk = view.informationHidden ? 0.25 : view.deck.filter(c => { const rank = faceRank(c); return rank !== null && ranks.has(rank); }).length / Math.max(1, view.deck.length);
  return { ...command, action: player.hand.length < 3 ? 'hit' : risk > 0.36 || (player.hand.length >= 4 && random() < 0.6) ? 'quit' : 'hit' };
}
