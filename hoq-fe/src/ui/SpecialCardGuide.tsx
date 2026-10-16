import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { specialGuide } from '../game/specials/guide';
import type { SpecialCardId } from '../game/types';
import { ALL_SPECIAL_CARDS, specialCardId } from '../game/specials/selection';
import { Button, Label, PlayingCard } from './components';
import { colors } from './theme';

interface Selection {
  enabled: readonly SpecialCardId[];
  onChange?: (enabled: SpecialCardId[]) => void;
  disabled?: boolean;
}
function Checkbox({ name, checked, disabled, onPress }: { name: string; checked: boolean; disabled: boolean; onPress(): void }) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{ checked, disabled }}
    disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [s.checkbox, checked && s.checked, focused && { borderColor: colors.coral }, pressed && { opacity: 0.7 }]}>
    <Label style={{ color: checked ? colors.ink : colors.cream, fontSize: 20 }}>{checked ? '✓' : ''}</Label>
  </Pressable>;
}
export function SpecialCardGuide({ selection }: { selection?: Selection }) {
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
      {selection?.onChange && <View style={s.selectionActions}>
        <Button label="SELECT ALL" small disabled={selection.disabled || selection.enabled.length === ALL_SPECIAL_CARDS.length} onPress={() => selection.onChange?.([...ALL_SPECIAL_CARDS])} />
        <Button label="SELECT NONE" small disabled={selection.disabled || selection.enabled.length === 0} onPress={() => selection.onChange?.([])} />
      </View>}
      <Label style={s.intro}>Action cards resolve when drawn. Suit blanks and the Rainbow Ace stay in your hand. Targets must still be playing; if an action has no legal target, it is used up.</Label>
      {specialGuide.map(entry => {
        const id = specialCardId(entry.card);
        const checked = selection?.enabled.includes(id ?? 'war') ?? false;
        return <View key={entry.card.id} style={s.row}>
        {selection && <Checkbox name={id ? `Include ${entry.name}` : 'All-Suit Blank (included with WAR)'} checked={checked}
          disabled={!id || !selection.onChange || !!selection.disabled} onPress={() => {
            if (id) selection.onChange?.(ALL_SPECIAL_CARDS.filter(option => option === id ? !checked : selection.enabled.includes(option)));
          }} />}
        <PlayingCard card={entry.card} width={72} />
        <View style={s.explanation}><Label accessibilityRole="header" style={s.name}>{entry.name}</Label><Label style={s.description}>{entry.description}</Label></View>
      </View>; })}
    </View>}
  </View>;
}
const s = StyleSheet.create({
  section: { width: '100%', maxWidth: 828, alignSelf: 'center', backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line },
  toggle: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16, borderWidth: 2, borderColor: 'transparent', minHeight: 64 },
  title: { flex: 1, color: colors.lime, fontSize: 22 }, symbol: { color: colors.lime, fontSize: 30 },
  entries: { paddingHorizontal: 16, paddingBottom: 20, gap: 16 }, intro: { fontSize: 14, color: colors.muted, lineHeight: 23 },
  selectionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkbox: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.line, flexShrink: 0 },
  checked: { backgroundColor: colors.lime, borderColor: colors.lime },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line },
  explanation: { flex: 1, minWidth: 0, gap: 8 }, name: { color: colors.cream, fontSize: 18 }, description: { color: colors.muted, fontSize: 14, lineHeight: 24 },
});
