import { effect, playerOptions, type SpecialDefinition, type FunState } from './contracts';

export const mustHit = (state: FunState, id: string): boolean => !!state.special?.allIn?.includes(id);

export const allIn: SpecialDefinition = {
  id: 'all-in', name: 'All-in',
  description: 'Choose an active player, including yourself. They cannot Quit until they reach at least seven cards. They still take their normal turns and can bust.',
  resolve(ctx, job) {
    if (job.data.stage !== 'target') {
      ctx.ask(effect(job.special, job.actorId, { stage: 'target' }), job.actorId,
        'Who must reach seven cards before they can Quit?', playerOptions(ctx.active()));
      return;
    }
    const target = ctx.player(job.data.choice);
    if (target.status !== 'playing') return;
    const affected = ctx.state.special!.allIn ??= [];
    if (target.hand.length < 7 && !affected.includes(target.id)) affected.push(target.id);
    ctx.say(target.hand.length >= 7 ? `${target.name} already has seven cards and can Quit.`
      : `${target.name} is All-in: Hit until reaching seven cards before quitting.`);
  },
};
