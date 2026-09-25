import { cardOptions, effect, playerOptions, type SpecialDefinition } from './contracts';

export const stealCard: SpecialDefinition = {
  id: 'steal-card',
  name: 'Steal Card',
  description: 'Choose another active player, then take a card of your choice from their hand.',
  resolve(ctx, job) {
    if (job.data.stage === 'card') {
      const target = ctx.player(job.data.targetId);
      if (target.status !== 'playing' || ctx.player(job.actorId).status !== 'playing') return;
      ctx.transfer(target.id, job.actorId, job.data.choice);
      ctx.say(`${ctx.player(job.actorId).name} stole a card from ${target.name}.`);
      ctx.settle(target.id, job.actorId);
      return;
    }
    if (job.data.stage === 'target') {
      const target = ctx.player(job.data.choice);
      ctx.ask(effect(job.special, job.actorId, { stage: 'card', targetId: target.id }), job.actorId,
        `Which card will you steal from ${target.name}?`, cardOptions(target));
      return;
    }
    ctx.ask(effect(job.special, job.actorId, { stage: 'target' }), job.actorId,
      'Who will you steal from?', playerOptions(ctx.active().filter(p => p.id !== job.actorId && p.hand.length > 0)));
  },
};
