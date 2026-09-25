import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, type TextProps, type ImageStyle } from 'react-native';
import { rankLabel } from '../game/standardRules';
import type { GameCard } from '../game/types';
import { faceRank, faceSuit } from '../game/specials/cards';
import { definitions } from '../game/specials/registry';
import { cardTheme, colors } from './theme';

export function Label({ style, ...props }: TextProps) { return <Text {...props} style={[styles.text, style]} />; }
export function Button({ label, onPress, disabled, selected, tone = 'cream', small = false }: {
  label: string; onPress(): void; disabled?: boolean; selected?: boolean; tone?: 'cream' | 'lime' | 'coral'; small?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: colors[tone] }, small && styles.smallButton, disabled && styles.disabled, pressed && { transform: [{ translateY: 2 }] }]}>
    <Label style={[styles.buttonText, small && { fontSize: 13 }]}>{label}</Label>
  </Pressable>;
}
export function cardLabel(card: GameCard): string {
  if (card.kind === 'hidden') return 'Hidden card';
  if (card.kind === 'special') return definitions[card.special].name;
  if (card.kind === 'rainbow' && !card.rankOverride && !card.suitOverride) return 'Rainbow Ace';
  const rank = faceRank(card), suit = faceSuit(card);
  return `${rank === null ? 'Blank' : rankLabel(rank)} of ${suit === 'all' ? 'all suits' : suit}`;
}
export function PlayingCard({ card, width = 90, animate = false }: { card?: GameCard; width?: number; animate?: boolean }) {
  const entrance = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => { Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver: true }).start(); }, [entrance]);
  const suit = card ? faceSuit(card) : null;
  const rank = card ? faceRank(card) : null;
  const plain = !!card && (card.kind === 'special' || card.kind === 'rainbow' || card.kind === 'hidden' || suit === 'all');
  const text = !card ? '' : card.kind === 'hidden' ? '?' : card.kind === 'special' ? definitions[card.special].name : card.kind === 'rainbow' ? 'Rainbow Ace' : suit === 'all' && rank === null ? 'All-Suit Blank' : rank === null ? '' : rankLabel(rank);
  return <Animated.View accessible accessibilityLabel={card ? cardLabel(card) : 'Draw deck'}
    style={{ width, height: width * 1.5, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
    {plain ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', padding: Math.max(4, width * 0.07) }]}><View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#000' }} /></View> : <Image source={card && suit && suit !== 'all' ? cardTheme.fronts[suit] : cardTheme.back} resizeMode="contain"
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }, Platform.OS === 'web' && ({ imageRendering: 'pixelated' } as ImageStyle)]} />}
    {card && <View style={[styles.rank, { padding: width * 0.1 }]}><Label style={{ color: '#151a18', fontSize: plain && card.kind !== 'hidden' ? Math.max(9, width * 0.15) : width * (rank === 10 ? 0.46 : 0.56), textAlign: 'center' }}>{text}</Label>{(card.rankOverride || card.suitOverride) && plain && <Label style={{ color: '#151a18', fontSize: 9, textAlign: 'center' }}>{cardLabel(card)}</Label>}</View>}
  </Animated.View>;
}
export function Hand({ cards, width = 90 }: { cards: readonly GameCard[]; width?: number }) {
  return <View style={styles.hand}>{cards.map(card => <PlayingCard key={card.id} card={card} width={width} animate />)}</View>;
}
const styles = StyleSheet.create({
  text: { fontFamily: cardTheme.font, color: colors.cream, fontSize: 16 },
  button: { minHeight: 52, paddingHorizontal: 24, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, borderBottomWidth: 5 },
  smallButton: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 3 },
  buttonText: { color: colors.ink, fontSize: 20 }, disabled: { opacity: 0.38 },
  rank: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hand: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' },
});
