import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Player, GameCard } from '../game/types';
import { Label } from './components';
import { colors } from './theme';

export function OpponentList({ players, activeId, stacked, compact, availableWidth, onInspect, hidden = false }: {
  players: Player<GameCard>[]; activeId: string | null; stacked: boolean; compact: boolean; hidden?: boolean;
  availableWidth: number; onInspect(id: string): void;
}) {
  const scroll = useRef<ScrollView>(null);
  const crowded = !stacked && players.length > 3;
  const tileWidth = Math.max(90, (availableWidth - (players.length - 1) * 8) / players.length);
  const activeIndex = players.findIndex(player => player.id === activeId);
  useEffect(() => {
    if (crowded && activeIndex >= 0) scroll.current?.scrollTo({
      x: Math.max(0, activeIndex * (tileWidth + 8) - (availableWidth - tileWidth) / 2), animated: true,
    });
  }, [crowded, activeIndex, tileWidth, availableWidth]);

  const cards = players.map((player, index) => <Pressable key={player.id} accessibilityRole="button"
    accessibilityLabel={`Inspect ${player.name}'s cards`} onPress={() => onInspect(player.id)}
    style={[s.player, compact && { paddingVertical: 7 }, !stacked && !crowded && { width: Math.min(320, (availableWidth - (players.length - 1) * 8) / players.length) }, crowded && [s.tile, { width: tileWidth }], player.id === activeId && s.active]}>
    {!crowded && <View style={[s.avatar, { backgroundColor: index % 2 ? colors.coral : colors.lime }]}><Label style={s.initial}>{player.name[0]}</Label></View>}
    <View style={!crowded && { flex: 1 }}>
      <Label style={[s.name, crowded && s.centered]}>{player.name} {!crowded && player.controller === 'bot' && <Label style={s.bot}>BOT</Label>}</Label>
      <Label style={[s.meta, crowded && s.centered]}>{hidden ? '?' : player.total} PTS · {player.hand.length} CARDS</Label>
    </View>
    <Label style={[s.badge, crowded && s.centered, { color: player.id === activeId ? colors.lime : player.status === 'bust' ? colors.coral : colors.muted }]}>
      {player.id === activeId ? 'THINKING' : player.status === 'playing' ? 'WAITING' : player.status === 'bust' ? 'BUST' : hidden ? 'QUIT' : `+${player.roundScore}`}
    </Label>
  </Pressable>);

  return stacked ? <View style={s.stack}>{cards}</View> :
    <ScrollView ref={scroll} horizontal style={s.strip} contentContainerStyle={s.row}>{cards}</ScrollView>;
}

const s = StyleSheet.create({
  stack: { gap: 10 }, strip: { flexGrow: 0, flexShrink: 0 },
  row: { flexGrow: 1, flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  player: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#102d28', borderWidth: 1, borderColor: colors.line },
  tile: { flexDirection: 'column', gap: 4, paddingHorizontal: 4, paddingVertical: 6 },
  active: { borderColor: colors.lime, backgroundColor: '#294e3e' },
  avatar: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a201d' },
  initial: { color: colors.ink, fontSize: 23 }, name: { fontSize: 16 }, bot: { color: colors.muted, fontSize: 10 },
  meta: { fontSize: 10, color: colors.muted, marginTop: 7 }, badge: { fontSize: 9, minWidth: 62, textAlign: 'right' },
  centered: { textAlign: 'center' },
});
