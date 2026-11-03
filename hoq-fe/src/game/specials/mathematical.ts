import { SUITS } from '../standardRules';
import type { StandardCard } from '../types';
import { effect, type SpecialDefinition } from './contracts';

export const mathematical: SpecialDefinition = {
  id: 'mathematical', name: 'Mathematical',
  description: 'Solve one of four multiplication-and-subtraction equations, one per suit. Choose an equation to add its result (Ace/1 through King/13) in that suit to your hand. The choice timer keeps ticking; a matching rank busts.',
  resolve(ctx, job) {
    if (!job.data.cards) {
      const cards: StandardCard[] = [];
      const options = SUITS.map((suit, i) => {
        const a = 2 + Math.floor(ctx.random() * 11);
        const b = 7 + Math.floor(ctx.random() * 6);
        const rank = 1 + Math.floor(ctx.random() * 13);
        cards.push({ id: `mathematical-${ctx.state.round}-${++ctx.state.special!.serial}`, kind: 'standard', suit, rank });
        return { label: `${suit}: ${a} × ${b} − ${a * b - rank}`, value: String(i) };
      });
      ctx.ask(effect(job.special, job.actorId, { cards }), job.actorId,
        'Choose an equation. Its answer becomes your card rank in that suit.', options);
      return;
    }
    const player = ctx.player(job.actorId);
    if (player.status !== 'playing') return;
    const card: StandardCard = job.data.cards[Number(job.data.choice)];
    player.hand.push(card);
    ctx.settle(player.id);
    ctx.say(`${player.name} solved Mathematical and received ${card.rank} of ${card.suit}.`);
  },
};
