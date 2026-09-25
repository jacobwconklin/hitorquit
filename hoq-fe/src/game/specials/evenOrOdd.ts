import { SUITS } from '../standardRules';
import type { Suit } from '../types';
import { playerOptions, type SpecialDefinition } from './contracts';

export const evenOrOdd: SpecialDefinition = {
  id: 'even-or-odd', name: 'Even or Odd',
  description: 'Choose a player, including yourself. They guess even or odd: win to choose one suit for their hand; lose to turn every card into an Ace.',
  resolve(ctx, job) {
    const { step, choice, targetId, rolled } = job.data;
    if (!step) {
      ctx.ask({ ...job, data: { step: 'target' } }, job.actorId, 'Who must play Even or Odd?', playerOptions(ctx.active()));
      return;
    }
    if (step === 'target') {
      ctx.ask({ ...job, data: { step: 'parity', targetId: choice } }, choice, 'Guess the parity of a random number from 0 to 9.', [
        { label: 'Even', value: 'even' }, { label: 'Odd', value: 'odd' },
      ]);
      return;
    }
    const target = ctx.player(targetId);
    if (target.status !== 'playing') return;
    if (step === 'parity') {
      const number = Math.floor(ctx.random() * 10);
      if ((number % 2 === 0 ? 'even' : 'odd') === choice) {
        ctx.say(`${target.name} guessed correctly: ${number}. Choose a suit for the entire hand.`);
        ctx.ask({ ...job, data: { step: 'suit', targetId, rolled: number } }, targetId, `You rolled ${number} and won! Choose your hand's suit.`,
          SUITS.map(suit => ({ label: suit[0].toUpperCase() + suit.slice(1), value: suit })));
      } else {
        target.hand = target.hand.map(card => ({ ...card, rankOverride: 1 }));
        ctx.say(`${target.name} guessed incorrectly: ${number}. Every card in their hand becomes an Ace.`);
        ctx.settle(targetId);
      }
      return;
    }
    if (step === 'suit') {
      target.hand = target.hand.map(card => ({ ...card, suitOverride: choice as Suit }));
      ctx.say(`${target.name} won Even or Odd with ${rolled}; their entire hand is now ${choice}.`);
      ctx.settle(targetId);
    }
  },
};
