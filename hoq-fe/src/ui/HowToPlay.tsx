import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StandardCard, Suit } from '../game/types';
import { isBust, scoreCards } from '../game/specials/cards';
import { Label, PlayingCard } from './components';
import { colors } from './theme';

const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
function hand(id: string, ranks: number[], suit?: Suit): StandardCard[] {
  return ranks.map((rank, index) => ({ id: `${id}-${index}`, kind: 'standard', rank, suit: suit ?? suits[index % suits.length] }));
}
const examples = [
  { name: 'Four cards', cards: hand('four', [2, 4, 7, 11]) },
  { name: 'Seven cards', cards: hand('seven', [1, 3, 5, 7, 9, 11, 13]) },
  { name: 'Flush: five cards of one suit', cards: hand('flush', [2, 4, 7, 9, 12], 'hearts') },
  { name: 'Straight: five consecutive ranks', cards: hand('straight', [3, 4, 5, 6, 7]) },
  { name: 'Bonuses stack', cards: hand('stack', [1, 2, 3, 4, 5, 6, 7], 'clubs') },
  { name: 'A pair of 4s: bust', cards: hand('bust', [2, 4, 7, 4]) },
  { name: 'Thirteen safe cards', cards: hand('win', Array.from({ length: 13 }, (_, index) => index + 1)) },
];
function result(cards: StandardCard[]) {
  if (isBust(cards)) return '0 points this round';
  if (cards.length >= 13) return 'win the game immediately';
  const score = scoreCards(cards);
  const parts = [`${score.cards} card points`];
  if (score.flush) parts.push(`${score.flush} flush`);
  if (score.straight) parts.push(`${score.straight} straight`);
  if (score.seven) parts.push(`${score.seven} seven-card bonus`);
  return `${parts.join(' + ')} = ${score.total} points when you Quit`;
}
function Bullet({ children }: { children: React.ReactNode }) {
  return <View style={s.bullet}><Label style={s.dot}>•</Label><Label style={s.rule}>{children}</Label></View>;
}
export function HowToPlay() {
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={s.section}>
    <Pressable accessibilityRole="button" accessibilityLabel="How to play" accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [s.toggle, focused && { borderColor: colors.coral }, pressed && { opacity: 0.75 }]}>
      <Label style={s.title}>How to play</Label>
      <Label accessibilityElementsHidden importantForAccessibility="no" style={s.symbol}>{expanded ? '−' : '+'}</Label>
    </Pressable>
    {expanded && <View style={s.content}>
      <Bullet>Start each round with one normal card. Selected special cards are mixed into the deck.</Bullet>
      <Bullet>Hit to draw. Quit to bank your hand's points and stop drawing for the round.</Bullet>
      <Bullet>Each scoring card is worth 1 point, regardless of rank. Blanks count; action specials resolve without staying in your hand.</Bullet>
      <Bullet>Any duplicate rank busts your hand: 0 points for the round. Previously banked rounds stay safe.</Bullet>
      <Bullet>Five cards of one suit earn a flush bonus of +3. Five consecutive ranks earn a straight bonus of +3; Ace can be low or high.</Bullet>
      <Bullet>Seven safe cards earn +5. You may keep hitting. Bonuses stack, once each per hand.</Bullet>
      <Bullet>Thirteen safe cards win the game immediately.</Bullet>
      <Bullet>Otherwise, bank points across rounds to reach the target. At the end of a round, the highest total at or above the target wins; ties share the win.</Bullet>
      <Bullet>Timed turns auto-Hit when time expires. Special choices auto-select an option. Unlimited turns have no timeout.</Bullet>
      <Bullet>In multiplayer, the host sets the target score and turn timer.</Bullet>
      {examples.map(example => <View key={example.name} style={s.example}>
        <Bullet>{example.name}: {result(example.cards)}.</Bullet>
        <View style={s.cards}>{example.cards.map(card => <PlayingCard key={card.id} card={card} width={48} />)}</View>
      </View>)}
    </View>}
  </View>;
}
const s = StyleSheet.create({
  section: { width: '100%', maxWidth: 828, alignSelf: 'center', backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, gap: 16, borderWidth: 2, borderColor: 'transparent', minHeight: 64 },
  title: { flex: 1, color: colors.lime, fontSize: 22 }, symbol: { color: colors.lime, fontSize: 30 },
  content: { paddingHorizontal: 16, paddingBottom: 20, gap: 14 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, dot: { color: colors.lime, fontSize: 16, lineHeight: 24 },
  rule: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 24, color: colors.cream },
  example: { gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 18 },
});
