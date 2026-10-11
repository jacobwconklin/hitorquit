import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { specialGuide } from '../game/specials/guide';
import { Label, PlayingCard } from './components';
import { colors } from './theme';

export function SpecialCardGuide() {
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={s.section}>
    <Pressable accessibilityRole="button" accessibilityLabel="Special card guide" accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={({ pressed }) => [s.toggle, focused && { borderColor: colors.coral }, pressed && { opacity: 0.75 }]}>
      <Label style={s.title}>Meet the special cards</Label>
      <Label accessibilityElementsHidden importantForAccessibility="no" style={s.symbol}>{expanded ? '−' : '+'}</Label>
    </Pressable>
    {expanded && <View style={s.entries}>
      <Label style={s.intro}>Action cards resolve when drawn. Suit blanks and the Rainbow Ace stay in your hand. Targets must still be playing; if an action has no legal target, it is used up.</Label>
      {specialGuide.map(entry => <View key={entry.card.id} style={s.row}>
        <PlayingCard card={entry.card} width={72} />
        <View style={s.explanation}><Label accessibilityRole="header" style={s.name}>{entry.name}</Label><Label style={s.description}>{entry.description}</Label></View>
      </View>)}
    </View>}
  </View>;
}
const s = StyleSheet.create({
  section: { width: '100%', maxWidth: 828, alignSelf: 'center', backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line },
  toggle: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, borderWidth: 2, borderColor: 'transparent', minHeight: 64 },
  title: { flex: 1, color: colors.lime, fontSize: 22 }, symbol: { color: colors.lime, fontSize: 30 },
  entries: { paddingHorizontal: 16, paddingBottom: 20, gap: 16 }, intro: { fontSize: 14, color: colors.muted, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line },
  explanation: { flex: 1, minWidth: 0, gap: 8 }, name: { color: colors.cream, fontSize: 18 }, description: { color: colors.muted, fontSize: 14, lineHeight: 24 },
});
