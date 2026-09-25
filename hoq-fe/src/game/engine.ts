import type { Card, Command, Config, GameEvent, GameState, Rules, Seat, Transition } from './types';
import { shuffle } from './standardRules';

export function createGame<C extends Card>(seats: Seat[], config: Config, deck: C[]): GameState<C> {
  if (seats.length < 2 || new Set(seats.map(s => s.id)).size !== seats.length) throw new Error('Provide at least two unique players.');
  if (!Number.isInteger(config.target) || config.target < 1 || (config.turnMs !== null && (!Number.isFinite(config.turnMs) || config.turnMs < 1000))) throw new Error('Invalid match settings.');
  const remaining = [...deck];
  const opening = seats.map(() => {
    const index = remaining.findIndex(card => card.kind === 'standard');
    if (index < 0) throw new Error('Not enough normal cards to deal.');
    return remaining.splice(index, 1)[0];
  });
  return {
    phase: 'playing', config: { ...config }, round: 1, activeIndex: 0, turnId: 1, history: [], winnerIds: [],
    players: seats.map((seat, i) => ({ ...seat, hand: [opening[i]], status: 'playing', total: 0, roundScore: 0 })),
    deck: remaining, decksAdded: 1,
  };
}

export function applyCommand<C extends Card>(state: GameState<C>, command: Command, rules: Rules<C>, random: () => number = Math.random): Transition<C> {
  if (rules.apply) return rules.apply(state, command, random);
  const active = state.players[state.activeIndex];
  if (state.phase !== 'playing' || command.turnId !== state.turnId || command.playerId !== active.id || active.status !== 'playing' || !['hit', 'quit'].includes(command.action)) return { state, events: [] };
  const player = { ...active, hand: [...active.hand] };
  let deck = [...state.deck];
  let decksAdded = state.decksAdded;
  const replenish = () => {
    if (deck.length < 13 && decksAdded === 1) {
      deck = shuffle([...deck, ...rules.createDeck().map(card => ({ ...card, id: `deck-2:${card.id}`, deckNumber: 2 }))], random);
      decksAdded = 2;
    }
  };
  let won = false;
  const bonuses: GameEvent[] = [];
  let type: GameEvent['type'] = command.action === 'quit' ? 'quit' : 'hit';
  if (command.action === 'hit' && deck.length) {
    const outcome = rules.resolveDraw(player.hand, deck.shift()!);
    player.hand = outcome.hand;
    if (outcome.bust) { player.status = 'bust'; type = 'bust'; }
    else {
      won = outcome.win === true;
      if (won || outcome.bank) { player.status = 'quit'; type = won ? 'win' : 'bank'; }
      const before = rules.score(active.hand), after = rules.score(player.hand);
      for (const [key, label] of [['seven', '7 cards'], ['flush', 'Flush'], ['straight', 'Straight']] as const) {
        if (after[key] > before[key]) bonuses.push({ type: 'bonus', playerId: player.id, message: `+${after[key] - before[key]} ${label} · ${player.name}` });
      }
    }
    replenish();
  } else { player.status = 'quit'; type = 'quit'; }
  if (player.status === 'quit') { player.roundScore = rules.score(player.hand).total; player.total += player.roundScore; }
  const players = state.players.map((p, i) => i === state.activeIndex ? player : p);
  let next: GameState<C> = { ...state, players, deck, decksAdded, turnId: state.turnId + 1 };
  if (won) {
    next = { ...next, phase: 'game-over', winnerIds: [player.id],
      history: [...state.history, { round: state.round, scores: Object.fromEntries(players.map(p => [p.id, p.roundScore])) }] };
  } else if (players.every(p => p.status !== 'playing')) {
    const highest = Math.max(...players.map(p => p.total));
    const winnerIds = highest >= state.config.target ? players.filter(p => p.total === highest).map(p => p.id) : [];
    next = { ...next, phase: winnerIds.length ? 'game-over' : 'round-over', winnerIds,
      history: [...state.history, { round: state.round, scores: Object.fromEntries(players.map(p => [p.id, p.roundScore])) }] };
  } else {
    let index = state.activeIndex;
    do { index = (index + 1) % players.length; } while (players[index].status !== 'playing');
    next.activeIndex = index;
  }
  const message = won ? `${player.name} reached 13 cards and wins instantly!` : type === 'bust' ? `${player.name} busted. No points this round.`
    : player.status === 'quit' ? `${player.name} banked ${player.roundScore} points.`
    : `${player.name} took a card. Still in!`;
  return { state: next, events: [{ type, playerId: player.id, message }, ...bonuses] };
}

export function nextRound<C extends Card>(state: GameState<C>, deck: C[]): GameState<C> {
  if (state.phase !== 'round-over') return state;
  const fresh = createGame(state.players, state.config, deck);
  return { ...state, round: state.round + 1, phase: 'playing', activeIndex: state.round % state.players.length,
    turnId: state.turnId + 1, deck: fresh.deck, decksAdded: 1,
    special: state.special ? { serial: state.special.serial + 1, queue: [], discard: [], dailyDouble: [], blinded: [], traps: state.special.traps, } : undefined,
    players: state.players.map((p, i) => ({ ...p, hand: fresh.players[i].hand, status: 'playing', roundScore: 0 })) };
}
