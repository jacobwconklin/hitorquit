import { cardOptions, effect, playerOptions, type SpecialDefinition } from './contracts';

export const ransom: SpecialDefinition = {
  id: 'ransom',
  name: 'Ransom',
  description: 'Choose another active player and demand a card of your choice. They must give it to you or immediately Hit.',
  resolve(ctx, job) {
    if (job.data.stage === 'response') {
      const target = ctx.player(job.data.targetId);
      if (target.status !== 'playing' || ctx.player(job.actorId).status !== 'playing') return;
      if (job.data.choice === 'give') {
        ctx.transfer(target.id, job.actorId, job.data.cardId);
        ctx.say(`${target.name} paid ${ctx.player(job.actorId).name}'s ransom.`);
        ctx.settle(target.id, job.actorId);
      } else {
        ctx.say(`${target.name} refused the ransom and must Hit.`);
        ctx.draw(target.id, ctx.hitCount(target.id));
      }
      return;
    }
    if (job.data.stage === 'card') {
      const target = ctx.player(job.data.targetId);
      ctx.ask(effect(job.special, job.actorId, { stage: 'response', targetId: target.id, cardId: job.data.choice }), target.id,
        `${ctx.player(job.actorId).name} demands this card. Give it up or Hit?`, [
          { label: 'Give the demanded card', value: 'give', cardId: job.data.choice },
          { label: `Hit (draw ${ctx.hitCount(target.id)})`, value: 'hit' },
        ]);
      return;
    }
    if (job.data.stage === 'target') {
      const target = ctx.player(job.data.choice);
      ctx.ask(effect(job.special, job.actorId, { stage: 'card', targetId: target.id }), job.actorId,
        `Which card will you demand from ${target.name}?`, cardOptions(target));
      return;
    }
    ctx.ask(effect(job.special, job.actorId, { stage: 'target' }), job.actorId,
      'Who must pay your ransom or Hit?', playerOptions(ctx.active().filter(p => p.id !== job.actorId && p.hand.length > 0)));
  },
};
