import { cardOptions, effect, type SpecialDefinition } from './contracts';

export const musicalChairs: SpecialDefinition = {
  id: 'musical-chairs', name: 'Musical Chairs',
  description: 'Choose left or right. Everyone still playing secretly chooses one card to pass in that direction.',
  resolve(ctx, job) {
    const { stage, choice } = job.data;
    if (!stage) {
      const participants = ctx.active().filter(p => p.hand.length).map(p => p.id);
      if (participants.length < 2) { ctx.say('Musical Chairs needs two players with cards.'); return; }
      ctx.ask(effect(job.special, job.actorId, { stage: 'direction', participants }), job.actorId, 'Which way should the cards move?', [
        { label: 'Left', value: 'left' }, { label: 'Right', value: 'right' },
      ]);
      return;
    }
    const participants: string[] = job.data.participants;
    const direction: string = stage === 'direction' ? choice : job.data.direction;
    const submissions: Record<string, string> = { ...job.data.submissions };
    if (stage === 'submit') submissions[job.data.chooser] = choice;
    const chooser = participants.find(id => !submissions[id]);
    if (chooser) {
      ctx.ask(effect(job.special, job.actorId, { stage: 'submit', participants, direction, submissions, chooser }), chooser,
        'Secretly choose one card to pass.', cardOptions(ctx.player(chooser)));
      return;
    }
    // Remove the whole batch before adding anything: temporary duplicate ranks must not bust players.
    const cards = participants.map(id => {
      const hand = ctx.player(id).hand;
      return hand.splice(hand.findIndex(card => card.id === submissions[id]), 1)[0];
    });
    participants.forEach((_, index) => {
      const next = (index + (direction === 'left' ? 1 : participants.length - 1)) % participants.length;
      ctx.player(participants[next]).hand.push(cards[index]);
    });
    ctx.say(`Musical Chairs passed everyone's chosen card ${direction}.`);
    ctx.settle(...participants);
  },
};
