import { effect, playerOptions, type SpecialDefinition } from './contracts';

export const dailyDouble: SpecialDefinition = {
  id: 'daily-double',
  name: 'Daily Double',
  description: 'Choose a player, including yourself. Each time they Hit this round, they must draw two cards.',
  resolve(ctx, job) {
    if (job.data.stage !== 'target') {
      ctx.ask(effect(job.special, job.actorId, { stage: 'target' }), job.actorId,
        'Who must draw two cards whenever they Hit this round?', playerOptions(ctx.active()));
      return;
    }
    const target = ctx.player(job.data.choice);
    if (target.status !== 'playing') return;
    const affected = ctx.state.special!.dailyDouble;
    if (!affected.includes(target.id)) affected.push(target.id);
    ctx.say(`${target.name} must draw two cards whenever they Hit for the rest of this round.`);
  },
};
