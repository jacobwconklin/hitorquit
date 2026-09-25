import { playerOptions, type SpecialDefinition } from './contracts';

export const blindfold: SpecialDefinition = {
  id: 'blindfold', name: 'Blindfold',
  description: 'Choose another active player. Their cards, scores, and deck information stay hidden through the end of their next turn.',
  resolve(ctx, job) {
    if (job.data.choice === undefined) {
      ctx.ask(job, job.actorId, 'Choose a player to blindfold.', playerOptions(ctx.active().filter(p => p.id !== job.actorId)));
      return;
    }
    const target = ctx.player(job.data.choice);
    if (target.status !== 'playing' || target.id === job.actorId) return;
    const specials = ctx.state.special!;
    specials.blinded = specials.blinded.filter(status => status.playerId !== target.id);
    specials.blinded.push({ playerId: target.id, appliedTurn: ctx.state.turnId });
    ctx.say(`${target.name} is blindfolded through the end of their next turn.`);
  },
};
