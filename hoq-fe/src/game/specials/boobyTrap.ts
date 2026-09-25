import { type SpecialDefinition } from './contracts';

export const boobyTrap: SpecialDefinition = {
  id: 'booby-trap', name: 'Booby Trap',
  description: 'Secretly choose a rank. The first opponent to draw it and survive must draw one more card. This trap lasts across rounds until triggered.',
  resolve(ctx, job) {
    if (job.data.choice === undefined) {
      ctx.ask(job, job.actorId, 'Secretly choose a rank for your Booby Trap.', Array.from({ length: 13 }, (_, i) => ({
        label: ({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' } as Record<number, string>)[i + 1] ?? String(i + 1), value: String(i + 1),
      })));
      return;
    }
    const rank = Number(job.data.choice);
    if (!Number.isInteger(rank) || rank < 1 || rank > 13) return;
    ctx.state.special!.traps.push({ ownerId: job.actorId, rank });
    ctx.say(`${ctx.player(job.actorId).name} armed a secret Booby Trap.`);
  },
};
