import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { GameCard, GameState } from '../game/types';
import type { GameSession } from '../session/types';
import { definitions } from '../game/specials/registry';
import { Button, Label, PlayingCard, cardLabel } from './components';
import { colors } from './theme';

export function SpecialPanel({ game, session, viewerId, connected }: { game: GameState<GameCard>; session: GameSession; viewerId: string; connected: boolean }) {
  const pending = game.special?.pending;
  const special = pending?.special ?? game.special?.last?.special;
  const card: GameCard | undefined = pending ? { id: 'resolution-card', kind: 'special', special: pending.special } : game.special?.lastCard;
  if (!special && !card && !game.informationHidden) return null;
  const definition = special ? definitions[special] : undefined;
  const description = definition?.description ?? (card?.kind === 'rainbow' ? 'An Ace of every suit. Counts once toward hand size; pairs with another Ace bust.' : card?.kind === 'blank' ? 'No rank: cannot form a pair or straight. Counts as one card and helps a flush.' : '');
  const choosing = !!pending && pending.actorId === viewerId;
  const actorName = game.players.find(p => p.id === pending?.actorId)?.name;
  const select = (optionId: string) => session.submit({ playerId: viewerId, round: game.round, turnId: game.turnId, action: 'choose', choiceId: pending!.id, optionId });
  return <View style={styles.panel}>
    <View style={styles.heading}>
      {card && <PlayingCard card={game.informationHidden ? { id: 'hidden-effect', kind: 'hidden' } : card} width={64} />}
      <View style={{ flex: 1, minWidth: 160, gap: 8 }}>
        <Label style={styles.title}>{game.informationHidden ? 'BLINDED' : definition?.name ?? (card ? cardLabel(card) : '')}</Label>
        <Label style={styles.description}>{game.informationHidden ? 'All cards and scores are hidden until your next turn ends.' : description}</Label>
        {!pending && !game.informationHidden && game.special?.last && <Label style={styles.description}>{game.special.last.message}</Label>}
      </View>
    </View>
    {pending && <><Label accessibilityLiveRegion="polite" style={styles.prompt}>{choosing ? pending.prompt : `${actorName ?? 'A player'} is choosing…`}</Label>
      {choosing && <View style={styles.options}>{pending.options.map(option => {
        const selectedCard = option.cardId ? game.players.flatMap(p => p.hand).find(c => c.id === option.cardId) : undefined;
        return selectedCard ? <Pressable key={`${pending.id}-${option.id}`} accessibilityRole="button" accessibilityLabel={`Choose ${option.label}: ${cardLabel(selectedCard)}`} disabled={!connected} onPress={() => select(option.id)} style={({ pressed }) => [styles.cardOption, { opacity: !connected ? 0.4 : pressed ? 0.65 : 1 }]}>
          <PlayingCard card={selectedCard} width={66} /><Label style={styles.caption}>{option.label}</Label>
        </Pressable> : <Button key={`${pending.id}-${option.id}`} label={option.label} small disabled={!connected} onPress={() => select(option.id)} />;
      })}</View>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, marginBottom: 16, gap: 14, backgroundColor: '#080b0a', borderWidth: 1, borderColor: '#ffffff' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
  title: { color: '#fff', fontSize: 18 }, description: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  prompt: { color: colors.lime, fontSize: 14, lineHeight: 22 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  cardOption: { alignItems: 'center', padding: 5, borderWidth: 1, borderColor: colors.lime, gap: 8 }, caption: { fontSize: 10, maxWidth: 80 },
});
