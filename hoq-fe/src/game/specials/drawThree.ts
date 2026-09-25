import { effect, playerOptions, type SpecialDefinition } from './contracts';

export const drawThree: SpecialDefinition = {
  id: 'draw-three',
  name: 'Draw 3',
  description: 'Choose a player, including yourself, to draw three cards immediately without quitting between draws.',
  resolve(ctx, job) {
    if (job.data.stage !== 'target') {
      ctx.ask(effect(job.special, job.actorId, { stage: 'target' }), job.actorId,
        'Who must draw three cards?', playerOptions(ctx.active()));
      return;
    }
    const target = ctx.player(job.data.choice);
    if (target.status !== 'playing') return;
    ctx.say(`${target.name} must draw three cards, stopping if they bust.`);
    ctx.draw(target.id, 3);
  },
};
