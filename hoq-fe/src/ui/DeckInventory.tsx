import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { getDeckInventory, RANKS } from '../game/deckInventory';
import { rankLabel } from '../game/standardRules';
import type { GameCard, StandardCard, Suit } from '../game/types';
import { Label, cardLabel } from './components';
import { colors } from './theme';

const suitColors: Record<Suit, string> = {
  spades: '#8bc8ff', clubs: '#a5d98b', hearts: colors.coral, diamonds: '#f4dc78',
};

export function DeckInventory({ deck, decksAdded }: { deck: readonly GameCard[]; decksAdded: number }) {
  const { rows, totals } = getDeckInventory(deck.filter((c): c is StandardCard => c.kind === 'standard'), decksAdded);
  const specials = new Map<string, number>();
  deck.filter(c => c.kind !== 'standard').forEach(c => { const label = cardLabel(c); specials.set(label, (specials.get(label) ?? 0) + 1); });
  return <View style={s.inventory}>
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={s.grid}>
        <View style={s.row}>
          <Label style={s.rowHeading}>RANK</Label>
          {RANKS.map(rank => <Label key={rank} style={[s.cell, s.rank]}>{rankLabel(rank)}</Label>)}
        </View>
        <View style={[s.row, s.totals]}>
          <Label style={[s.rowHeading, s.total]}>REMAINING</Label>
          {totals.map((count, index) => <Label key={index} accessibilityLabel={`${rankLabel(RANKS[index])}: ${count} remaining`}
            style={[s.cell, s.total]}>{count}</Label>)}
        </View>
        {rows.map(({ suit, counts, deckNumber }) => <View key={`${deckNumber}-${suit}`} style={s.row}>
          <Label style={[s.rowHeading, { color: suitColors[suit] }]}>{suit.toUpperCase()}{deckNumber === 2 ? ' · 2' : ''}</Label>
          {counts.map((count, index) => <View key={index} accessible
            accessibilityLabel={`Deck ${deckNumber}, ${rankLabel(RANKS[index])} of ${suit}: ${count === 0 ? 'dealt' : `${count} remaining`}`}
            style={s.markerCell}>{count > 0 && <View style={[s.marker, { backgroundColor: suitColors[suit] }]} />}</View>)}
        </View>)}
      </View>
    </ScrollView>
    <Label style={{ fontSize: 13 }}>SPECIALS REMAINING</Label>
    {[...specials].map(([label, count]) => <Label key={label} style={{ fontSize: 12 }}>{label} · {count}</Label>)}
    {!specials.size && <Label style={{ fontSize: 12 }}>None</Label>}
  </View>;
}

const s = StyleSheet.create({
  inventory: { gap: 12 },
  grid: { flexGrow: 1, borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line },
  rowHeading: { width: 100, fontSize: 10, paddingVertical: 12, paddingLeft: 8, borderRightWidth: 1, borderColor: colors.line },
  cell: { minWidth: 35, flex: 1, fontSize: 15, textAlign: 'center', paddingVertical: 10, borderRightWidth: 1, borderColor: colors.line },
  markerCell: { minWidth: 35, flex: 1, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderColor: colors.line },
  marker: { width: 12, height: 12, borderRadius: 6 },
  rank: { color: colors.cream },
  totals: { backgroundColor: colors.tableLight },
  total: { color: '#ffffff' },
});
