import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { Card, GameState } from '../game/types';
import { matchResults } from '../game/results';
import { Label } from './components';
import { colors } from './theme';

export function MatchResults<C extends Card>({ game, localPlayerId }: { game: GameState<C>; localPlayerId?: string }) {
  const { width } = useWindowDimensions();
  const rows = matchResults(game);
  const winners = rows.filter(p => p.winner);
  return <View style={s.results}>
    <View style={s.hero}>
      <Label style={s.eyebrow}>THE FINAL HAND · {game.history.length} ROUNDS</Label>
      <Label style={s.crown}>{winners.length > 1 ? 'SHARED VICTORY' : 'WINNER'}</Label>
      {winners.map(p => <Label key={p.id} style={[s.winner, { fontSize: width < 600 ? 38 : 56 }]}>{p.name}</Label>)}
      <Label style={s.subtitle}>{winners.length ? `${winners.length === 1 ? `${winners[0].total} points · ` : ''}${winners.some(p => p.id === localPlayerId) ? 'You played your cards right.' : 'A hand worth celebrating.'}` : 'The final standings'}</Label>
    </View>
    <View style={s.standings}>
      <Label style={s.title}>The table, settled.</Label>
      <Label style={s.hint}>Final standings · highest score first</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ minWidth: 560, flexGrow: 1 }}>
          <View style={[s.row, s.tableHeader]}>
            <Label style={s.rank}>#</Label><Label style={s.name}>PLAYER</Label>
            {['POINTS', 'BUSTS', 'BIGGEST\nHAND', 'BEST\nROUND'].map(label => <Label key={label} style={s.column}>{label}</Label>)}
          </View>
          {rows.map((p, i) => <View key={p.id} style={[s.row, p.winner && s.winnerRow]}>
            <Label style={s.rank}>{i > 0 && rows[i - 1].total === p.total ? rows.findIndex(r => r.total === p.total) + 1 : i + 1}</Label>
            <View style={s.name}><Label style={s.playerName}>{p.name}</Label><Label style={s.badge}>{[p.winner ? 'WINNER' : '', p.id === localPlayerId ? 'YOU' : ''].filter(Boolean).join(' · ')}</Label></View>
            <Label style={[s.column, s.points]}>{p.total}</Label>
            <Label style={[s.column, p.busts ? { color: colors.coral } : {}]}>{p.busts ?? '—'}</Label>
            <Label style={s.column}>{p.biggestHand ?? '—'}</Label>
            <Label style={s.column}>{p.bestRound ?? '—'}</Label>
          </View>)}
        </View>
      </ScrollView>
      <Label style={s.hint}>Biggest hand is the most cards held at once, including a busting card. Best round is the most points banked in one round. Swipe the table for more stats on small screens.</Label>
    </View>
  </View>;
}
const s = StyleSheet.create({
  results: { borderWidth: 1, borderColor: colors.line, overflow: 'hidden', borderRadius: 16 },
  hero: { backgroundColor: colors.lime, padding: 28, gap: 12, alignItems: 'center', borderBottomWidth: 5, borderColor: colors.ink },
  eyebrow: { color: colors.ink, fontSize: 11, letterSpacing: 2, textAlign: 'center' },
  crown: { color: colors.ink, fontSize: 14, letterSpacing: 4, fontWeight: 'bold', marginTop: 12 },
  winner: { color: colors.ink, fontWeight: 'bold', textAlign: 'center', width: '100%', flexShrink: 1 },
  subtitle: { color: colors.ink, fontSize: 15, textAlign: 'center', marginBottom: 8 },
  standings: { backgroundColor: colors.ink, padding: 18, gap: 12 },
  title: { fontSize: 24, color: colors.cream }, hint: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: colors.line },
  tableHeader: { paddingVertical: 10 }, winnerRow: { backgroundColor: colors.tableLight },
  rank: { width: 24, color: colors.muted, fontSize: 12 }, name: { flex: 1, minWidth: 140 },
  playerName: { fontSize: 17, flexShrink: 1 }, badge: { fontSize: 10, color: colors.lime, marginTop: 4 },
  column: { width: 76, textAlign: 'center', fontSize: 12, color: colors.cream }, points: { fontSize: 24, fontWeight: 'bold', color: colors.lime },
});
