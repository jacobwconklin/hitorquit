import { faceRank } from './cards';
import { cardOptions, effect, type SpecialDefinition } from './contracts';

export const war: SpecialDefinition = {
  id: 'war', name: 'WAR',
  description: 'Everyone still playing secretly submits one card. Highest wins an all-suit blank; lowest takes up to three submitted cards. Ace is high.',
  resolve(ctx, job) {
    const participants: string[] = job.data.participants ?? ctx.active().filter(p => p.hand.length).map(p => p.id);
    if (participants.length < 2) { ctx.say('WAR needs two players with cards.'); return; }
    const submissions: Record<string, string> = { ...job.data.submissions };
    if (job.data.chooser) submissions[job.data.chooser] = job.data.choice;
    const chooser = participants.find(id => !submissions[id]);
    if (chooser) {
      const player = ctx.player(chooser);
      ctx.ask(effect(job.special, job.actorId, { participants, submissions, chooser }), chooser,
        'Secretly submit one card to WAR. Ace is high; a blank is lowest.', cardOptions(player));
      return;
    }
    const entries = participants.map(id => {
      const hand = ctx.player(id).hand;
      const card = hand.splice(hand.findIndex(c => c.id === submissions[id]), 1)[0];
      const rank = faceRank(card);
      return { playerId: id, card, rank: rank === 1 ? 14 : rank ?? 0 };
    });
    const high = Math.max(...entries.map(e => e.rank));
    const low = Math.min(...entries.map(e => e.rank));
    const winners = entries.filter(e => e.rank === high);
    const winner = winners[Math.floor(ctx.random() * winners.length)].playerId;
    const losers = entries.filter(e => e.rank === low && e.playerId !== winner);
    const loser = losers[Math.floor(ctx.random() * losers.length)].playerId;
    ctx.player(winner).hand.push({ id: `war-reward-${ctx.state.round}-${++ctx.state.special!.serial}`, kind: 'blank', suit: 'all' });
    const pool = entries.map(entry => entry.card);
    const penalty = [];
    while (pool.length && penalty.length < 3) penalty.push(pool.splice(Math.floor(ctx.random() * pool.length), 1)[0]);
    ctx.player(loser).hand.push(...penalty);
    ctx.state.special!.discard.push(...pool);
    ctx.say(`${ctx.player(winner).name} won WAR's all-suit blank; ${ctx.player(loser).name} received ${penalty.length} submitted cards.`);
    ctx.settle(...participants);
  },
};
