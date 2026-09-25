import { cardOptions, effect, playerOptions, type Job, type SpecialDefinition } from './contracts';

export const chicken: SpecialDefinition = {
  id: 'chicken', name: 'Chicken',
  description: 'Challenge a player. Secretly choose Hit or Quit each step. Keep hitting until someone quits or busts. A surviving hitter steals one card from the quitter.',
  resolve(ctx, job) {
    const { stage, choice } = job.data;
    if (!stage) {
      ctx.ask(effect(job.special, job.actorId, { stage: 'target' }), job.actorId, 'Choose a player to challenge to Chicken.',
        playerOptions(ctx.active().filter(p => p.id !== job.actorId)));
      return;
    }
    const participants: string[] = stage === 'target'
      ? ctx.state.players.filter(p => p.id === job.actorId || p.id === choice).map(p => p.id)
      : job.data.participants;
    if (stage === 'after-single-hit') {
      const quitter = ctx.player(job.data.quitter), hitter = ctx.player(job.data.hitter);
      if (hitter.status === 'playing' && quitter.status === 'playing' && quitter.hand.length) {
        ctx.ask(effect(job.special, job.actorId, { stage: 'steal', participants, quitter: quitter.id, hitter: hitter.id }), hitter.id,
          `Take one card from ${quitter.name} before they bank.`, cardOptions(quitter));
      } else {
        ctx.bank(quitter.id);
        ctx.say('Chicken ended without a theft.');
      }
      return;
    }
    if (stage === 'steal') {
      ctx.transfer(job.data.quitter, job.data.hitter, choice);
      ctx.bank(job.data.quitter);
      ctx.settle(job.data.hitter);
      ctx.say(`${ctx.player(job.data.hitter).name} took a card from ${ctx.player(job.data.quitter).name}. Chicken is over.`);
      return;
    }
    if (participants.some(id => ctx.player(id).status !== 'playing')) {
      ctx.say('Chicken is over because a participant finished.');
      return;
    }
    const choices: Record<string, string> = stage === 'pick' ? { ...job.data.choices, [job.data.chooser]: choice } : {};
    const chooser = participants.find(id => !choices[id]);
    if (chooser) {
      ctx.ask(effect(job.special, job.actorId, { stage: 'pick', participants, choices, chooser }), chooser,
        'Chicken: secretly choose Hit or Quit. Quitting banks your hand after any penalty.', [
          { label: `Hit (${ctx.hitCount(chooser)} card${ctx.hitCount(chooser) === 1 ? '' : 's'})`, value: 'hit' },
          { label: 'Quit', value: 'quit' },
        ]);
      return;
    }
    const hitters = participants.filter(id => choices[id] === 'hit');
    if (!hitters.length) {
      participants.forEach(id => ctx.bank(id));
      ctx.say('Both players quit Chicken together. No penalty.');
      return;
    }
    const draws: Job[] = hitters.map(playerId => ({ type: 'draw', playerId, count: ctx.hitCount(playerId) }));
    const continuation = hitters.length === 2 ? { stage: 'repeat', participants }
      : { stage: 'after-single-hit', participants, hitter: hitters[0], quitter: participants.find(id => id !== hitters[0]) };
    ctx.enqueue(...draws, effect(job.special, job.actorId, continuation));
    ctx.say(hitters.length === 2 ? 'Both players hit. Chicken continues if both survive.' : 'One player quit. Resolve the other player’s Hit before any theft.');
  },
};
