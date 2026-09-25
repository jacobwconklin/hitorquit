import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View, type TextProps, type ImageStyle } from 'react-native';
import { rankLabel } from '../game/standardRules';
import type { StandardCard } from '../game/types';
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
export function PlayingCard({ card, width = 90, animate = false }: { card?: StandardCard; width?: number; animate?: boolean }) {
  const entrance = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => { Animated.timing(entrance, { toValue: 1, duration: 220, useNativeDriver: true }).start(); }, [entrance]);
  return <Animated.View accessible accessibilityLabel={card ? `${rankLabel(card.rank)} of ${card.suit}` : 'Draw deck'}
    style={{ width, height: width * 1.5, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
    <Image source={card ? cardTheme.fronts[card.suit] : cardTheme.back} resizeMode="contain"
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }, Platform.OS === 'web' && ({ imageRendering: 'pixelated' } as ImageStyle)]} />
    {card && <View style={styles.rank}><Label style={{ color: '#151a18', fontSize: width * (card.rank === 10 ? 0.46 : 0.56), textAlign: 'center' }}>{rankLabel(card.rank)}</Label></View>}
  </Animated.View>;
}
export function Hand({ cards, width = 90 }: { cards: readonly StandardCard[]; width?: number }) {
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
