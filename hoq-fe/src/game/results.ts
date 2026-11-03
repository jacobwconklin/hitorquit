import type { Card, GameState, Player, RoundResult } from './types';

// Capture before the next deal replaces hands/statuses. Optional on the wire for older servers.
export function roundResult<C extends Card>(round: number, players: Player<C>[]): RoundResult {
  return {
    round,
    scores: Object.fromEntries(players.map(p => [p.id, p.roundScore])),
    players: Object.fromEntries(players.map(p => [p.id, { name: p.name, status: p.status, cards: Math.max(p.roundMaxHand ?? 0, p.hand.length) }])),
  };
}

export function matchResults<C extends Card>(game: GameState<C>) {
  const ids = new Set([...game.players.map(p => p.id), ...game.history.flatMap(r => Object.keys(r.players ?? {}))]);
  return [...ids].map(id => {
    const player = game.players.find(p => p.id === id);
    const rounds = game.history.filter(r => id in r.scores);
    const details = rounds.map(r => r.players?.[id]);
    const complete = rounds.length > 0 && details.every(Boolean);
    return {
      id, name: player?.name ?? details.find(Boolean)!.name,
      total: player?.total ?? rounds.reduce((sum, r) => sum + r.scores[id], 0),
      winner: game.winnerIds.includes(id),
      busts: complete ? details.filter(p => p!.status === 'bust').length : null,
      biggestHand: complete ? Math.max(...details.map(p => p!.cards)) : null,
      bestRound: rounds.length ? Math.max(...rounds.map(r => r.scores[id])) : null,
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
