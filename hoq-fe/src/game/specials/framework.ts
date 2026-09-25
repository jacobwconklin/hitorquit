import type { Command, GameCard, Rules, SpecialId, Transition } from '../types';
import { shuffle, standardRules, SUITS } from '../standardRules';
import { type EffectContext, type FunState, type Job, type SpecialState, effect } from './contracts';
import { definitions } from './registry';
import { faceRank, isBust, scoreCards } from './cards';

export const SPECIAL_IDS: SpecialId[] = ['daily-double', 'musical-chairs', 'even-or-odd', 'draw-three', 'steal-card', 'blindfold', 'ransom', 'booby-trap', 'war', 'chicken'];
export const emptySpecialState = (): SpecialState => ({ serial: 0, queue: [], discard: [], dailyDouble: [], blinded: [], traps: [] });
export function createFunDeck(): GameCard[] {
  return [...standardRules.createDeck(), ...SPECIAL_IDS.map(special => ({ id: `special-${special}`, kind: 'special' as const, special })),
    ...SUITS.map(suit => ({ id: `blank-${suit}`, kind: 'blank' as const, suit })), { id: 'rainbow-ace', kind: 'rainbow', rank: 1, suit: 'all' }];
}
export const decisionKey = (state: FunState) => `${state.round}:${state.turnId}:${state.special?.pending?.id ?? 'action'}`;
export const decisionActor = (state: FunState) => state.special?.pending?.actorId ?? state.players[state.activeIndex].id;
export function fallbackCommand(state: FunState): Command {
  const pending = state.special?.pending;
  return { playerId: decisionActor(state), turnId: state.turnId, round: state.round,
    action: pending ? 'choose' : 'hit', choiceId: pending?.id, optionId: pending?.options[0]?.id };
}
export function validCommand(state: FunState, command: Command): boolean {
  if (state.phase !== 'playing' || command.turnId !== state.turnId || (command.round !== undefined && command.round !== state.round) || command.playerId !== decisionActor(state)) return false;
  const pending = state.special?.pending;
  return pending ? command.action === 'choose' && command.choiceId === pending.id && pending.options.some(o => o.id === command.optionId)
    : (command.action === 'hit' || command.action === 'quit') && state.players[state.activeIndex].status === 'playing';
}
export function applySpecialCommand(original: FunState, command: Command, random: () => number): Transition<GameCard> {
  if (!validCommand(original, command)) return { state: original, events: [] };
  const state: FunState = JSON.parse(JSON.stringify(original));
  state.special ??= emptySpecialState();
  const s = state.special;
  const events: Transition<GameCard>['events'] = [];
  const ctx: EffectContext = {
    state, events, random,
    player: id => { const p = state.players.find(p => p.id === id); if (!p) throw new Error('Unknown player'); return p; },
    active: () => state.players.filter(p => p.status === 'playing'),
    say: message => { events.push({ type: 'special', message }); if (s.last) s.last.message = message; },
    ask(job, actorId, prompt, options) {
      if (!options.length) { ctx.say('No eligible choice. The special has no effect.'); return; }
      s.pending = { id: `choice-${++s.serial}`, actorId, special: job.special, prompt,
        options: options.map((o, i) => ({ ...o, id: `option-${i}` })), job };
    },
    enqueue: (...jobs) => { s.queue.unshift(...jobs); },
    draw: (playerId, count) => { s.queue.unshift({ type: 'draw', playerId, count }); },
    hitCount: id => s.dailyDouble.includes(id) ? 2 : 1,
    settle(...ids) {
      // Settle all busts first; only surviving hands can claim thirteen.
      for (const id of new Set(ids)) {
        const p = ctx.player(id);
        if (p.status !== 'playing') continue;
        if (isBust(p.hand)) { p.status = 'bust'; p.roundScore = 0; events.push({ type: 'bust', playerId: id, message: `${p.name} busted. No points this round.` }); }
      }
      const winners = [...new Set(ids)].filter(id => ctx.player(id).status === 'playing' && ctx.player(id).hand.length >= 13);
      if (winners.length) {
        winners.forEach(id => ctx.bank(id)); state.phase = 'game-over'; state.winnerIds = winners;
        events.push({ type: 'win', message: `${winners.map(id => ctx.player(id).name).join(' and ')} reached 13 cards!` });
      }
      s.blinded = s.blinded.filter(b => ctx.player(b.playerId).status === 'playing');
    },
    bank(id) {
      const p = ctx.player(id); if (p.status !== 'playing') return;
      p.status = 'quit'; p.roundScore = scoreCards(p.hand).total; p.total += p.roundScore;
      events.push({ type: 'bank', playerId: id, message: `${p.name} banked ${p.roundScore} points.` });
    },
    transfer(from, to, cardId) {
      const source = ctx.player(from), target = ctx.player(to);
      const i = source.hand.findIndex(c => c.id === cardId);
      if (i < 0) throw new Error('Card no longer belongs to source');
      target.hand.push(source.hand.splice(i, 1)[0]);
    },
  };
  function replenish() {
    if (state.deck.length < 13 && state.decksAdded === 1) {
      state.deck = shuffle([...state.deck, ...createFunDeck().map(c => ({ ...c, id: `deck-2:${c.id}`, deckNumber: 2 }))], random);
      state.decksAdded = 2; events.push({ type: 'special', message: 'A second deck has been shuffled in.' });
    }
  }
  function run(job: Job) {
    if (job.type === 'effect') {
      s.last = { special: job.special, message: definitions[job.special]?.description ?? job.special };
      const definition = definitions[job.special];
      if (!definition) throw new Error(`Missing special definition: ${job.special}`);
      definition.resolve(ctx, job); return;
    }
    const p = ctx.player(job.playerId);
    if (p.status !== 'playing' || job.count < 1) return;
    replenish();
    const card = state.deck.shift();
    if (!card) { ctx.bank(p.id); return; }
    if (card.kind !== 'standard') s.lastCard = card;
    if (job.count > 1) ctx.enqueue({ ...job, count: job.count - 1 });
    if (card.kind === 'special') { s.discard.push(card); ctx.enqueue(effect(card.special, p.id)); }
    else {
      const before = scoreCards(p.hand); p.hand.push(card); ctx.settle(p.id);
      if (p.status === 'playing') {
        const after = scoreCards(p.hand);
        for (const key of ['seven', 'flush', 'straight'] as const) if (after[key] > before[key]) events.push({ type: 'bonus', playerId: p.id, message: `+${after[key] - before[key]} ${key} · ${p.name}` });
        events.push({ type: 'hit', playerId: p.id, message: `${p.name} drew a card.` });
        const triggered = s.traps.filter(t => t.ownerId !== p.id && t.rank === faceRank(card));
        s.traps = s.traps.filter(t => !triggered.includes(t));
        if (triggered.length) { ctx.say(`${p.name} triggered ${triggered.length} Booby Trap${triggered.length > 1 ? 's' : ''}!`); ctx.draw(p.id, triggered.length); }
      }
    }
    replenish();
  }
  if (s.pending) {
    const pending = s.pending; const option = pending.options.find(o => o.id === command.optionId)!;
    delete s.pending; ctx.enqueue({ ...pending.job, data: { ...pending.job.data, choice: option.value } });
  } else {
    delete s.last;
    delete s.lastCard;
    if (command.action === 'quit') ctx.bank(command.playerId);
    else ctx.draw(command.playerId, ctx.hitCount(command.playerId));
  }
  let steps = 0;
  while (s.queue.length && !s.pending && state.phase === 'playing') {
    if (++steps > 1000) throw new Error('Effect resolution exceeded finite deck limit');
    run(s.queue.shift()!);
  }
  if (!s.pending || state.phase !== 'playing') {
    const owner = state.players[state.activeIndex].id;
    s.blinded = s.blinded.filter(b => ctx.player(b.playerId).status === 'playing' && !(b.playerId === owner && b.appliedTurn < state.turnId));
    if (state.phase === 'game-over' || state.players.every(p => p.status !== 'playing')) {
      s.queue = []; delete s.pending; s.blinded = [];
      if (state.phase !== 'game-over') {
        const highest = Math.max(...state.players.map(p => p.total));
        state.winnerIds = highest >= state.config.target ? state.players.filter(p => p.total === highest).map(p => p.id) : [];
        state.phase = state.winnerIds.length ? 'game-over' : 'round-over';
      }
      state.history.push({ round: state.round, scores: Object.fromEntries(state.players.map(p => [p.id, p.roundScore])) });
    } else {
      do { state.activeIndex = (state.activeIndex + 1) % state.players.length; } while (state.players[state.activeIndex].status !== 'playing');
    }
    state.turnId++;
  }
  return { state, events };
}
export const funRules: Rules<GameCard> = {
  createDeck: createFunDeck, score: scoreCards, apply: applySpecialCommand,
  resolveDraw(hand, drawn) { const next = [...hand, drawn]; return { hand: next, bust: isBust(next), bank: false, win: next.length >= 13 && !isBust(next) }; },
};
