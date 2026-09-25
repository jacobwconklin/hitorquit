import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, AppState, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { scoreCards } from '../game/specials/cards';
import type { GameSession } from '../session/types';
import { Button, Hand, Label, PlayingCard } from './components';
import { colors } from './theme';
import { DeckInventory } from './DeckInventory';
import { OpponentList } from './OpponentList';
import { SpecialPanel } from './SpecialPanel';

function BonusToast({ messages }: { messages: string[] }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(progress, { toValue: 2, duration: 500, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: '35%', alignSelf: 'center', zIndex: 10,
    backgroundColor: colors.ink, borderColor: colors.lime, borderWidth: 2, padding: 20, maxWidth: '94%',
    opacity: progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1, 2], outputRange: [25, 0, -55] }) }] }}>
    {messages.map(message => <Label key={message} accessibilityLiveRegion="polite" style={{ color: colors.lime, fontSize: 26, textAlign: 'center' }}>{message}</Label>)}
    <Label style={{ textAlign: 'center', color: colors.cream }}>Keep hitting or quit to bank!</Label>
  </Animated.View>;
}

export function GameTable({ session, onLeave }: { session: GameSession; onLeave(): void }) {
  const { game, deadline, events, localPlayerId, multiplayer } = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState<string | null>(null);
  const [bonus, setBonus] = useState<{ id: number; messages: string[] } | null>(null);
  const lastBonusTurn = useRef(-1);
  const hidden = !!game.informationHidden;
  useEffect(() => { if (hidden) { setPanel(null); setBonus(null); } }, [hidden]);
  useEffect(() => { if (game.special?.pending) setPanel(null); }, [game.special?.pending?.id]);
  useEffect(() => {
    const messages = hidden ? [] : events.filter(event => event.type === 'bonus').map(event => event.message);
    if (messages.length && lastBonusTurn.current !== game.turnId) {
      lastBonusTurn.current = game.turnId;
      setBonus({ id: game.turnId, messages });
    }
  }, [events, game.turnId, hidden]);
  const { width, height } = useWindowDimensions();
  const mobile = width < 1024;
  const compact = !mobile && height < 600;
  const tableScroll = useRef<ScrollView>(null);
  const initialScroll = useRef({ pending: mobile, viewport: 0, content: 0, frame: 0 });
  function scrollToStartingHand() {
    const layout = initialScroll.current;
    if (!layout.pending || !layout.viewport || !layout.content) return;
    layout.pending = false;
    layout.frame = requestAnimationFrame(() => tableScroll.current?.scrollToEnd({ animated: false }));
  }
  useEffect(() => () => cancelAnimationFrame(initialScroll.current.frame), []);
  const human = game.players.find(p => localPlayerId ? p.id === localPlayerId : p.controller === 'human')!;
  const opponents = game.players.filter(p => p.id !== human.id);
  const pending = game.special?.pending;
  const active = game.players.find(p => p.id === pending?.actorId) ?? game.players[game.activeIndex];
  const canAct = game.phase === 'playing' && !pending && active.id === human.id && (!multiplayer || multiplayer.connected);
  const seconds = deadline === null ? 0 : Math.max(0, (deadline - now) / 1000);
  const unlimited = game.config.turnMs === null;
  const score = scoreCards(human.hand);
  // Mobile cards wrap at a readable size rather than shrinking to fit one row.
  const cardWidth = mobile ? 72 : Math.min(compact ? 60 : 100, (width - 48 - Math.max(0, human.hand.length - 1) * 6) / Math.max(1, human.hand.length));
  useEffect(() => {
    if (deadline === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') session.resume(); });
    return () => subscription.remove();
  }, [session]);
  const inspected = game.players.find(p => p.id === panel);
  const finished = game.phase !== 'playing';
  return <View style={s.table}>
    {multiplayer && <View style={{ padding: 10, gap: 6 }}><Label selectable>CODE: {multiplayer.joinCode} · {multiplayer.isHost ? 'YOU ARE HOST' : 'MULTIPLAYER'}{!multiplayer.connected ? ' · RECONNECTING' : ''}</Label>{multiplayer.error && <Label accessibilityLiveRegion="polite" style={{ color: colors.coral }}>{multiplayer.error}</Label>}</View>}
    <ScrollView ref={tableScroll} style={s.tableScroll} contentContainerStyle={s.tableContent}
      onLayout={event => { initialScroll.current.viewport = event.nativeEvent.layout.height; scrollToStartingHand(); }}
      onContentSizeChange={(_, contentHeight) => { initialScroll.current.content = contentHeight; scrollToStartingHand(); }}>
    <View style={[s.header, compact && { paddingVertical: 8 }, mobile && s.mobileHeader]}>
      <View style={s.brand}><Label style={[s.title, compact && { fontSize: 23 }, mobile && { fontSize: 28 }]}>HIT <Label style={s.or}>or</Label> QUIT</Label><Label style={s.kicker}>A LITTLE LUCK. A LITTLE NERVE.</Label></View>
      <View style={[s.headerRight, mobile && s.mobileHeaderRight]}><Label style={s.headerMeta}>ROUND {String(game.round).padStart(2, '0')}   /   FIRST TO {game.config.target}</Label><Pressable accessibilityRole="button" onPress={() => setPanel('leave')}><Label style={s.exit}>EXIT</Label></Pressable></View>
    </View>
    <View style={[s.arena, compact && { paddingTop: 9, paddingBottom: 8 }, mobile && s.mobileArena]}>
      {!mobile && <View pointerEvents="none" style={s.tableLine} />}
      <OpponentList players={opponents} hidden={hidden} activeId={finished ? null : active.id} stacked={mobile} compact={compact} availableWidth={width - 48} onInspect={setPanel} />
      <View style={[s.center, mobile && s.mobileCenter]}>
        {!compact && !mobile && <Label style={s.centerEyebrow}>PUSH YOUR LUCK</Label>}
        {mobile && <Button label="SCORES / DECK →" disabled={hidden} onPress={() => setPanel('scores')} />}
        <View style={s.deckRow}><View style={s.deckStack}><PlayingCard width={compact ? 48 : 72} /></View>
          <View style={s.deckInfo}><Label style={s.deckCount}>{game.deck.length} <Label style={s.subtle}>in the deck</Label></Label>{!mobile && <Button label="SCORES / DECK →" disabled={hidden} onPress={() => setPanel('scores')} small />}</View>
        </View>
        <Label accessibilityLiveRegion="polite" style={[s.event, compact && { marginTop: 8, fontSize: 12 }]}>{events[0]?.message ?? `${game.players.length} players. Reach 13 cards to win instantly.`}</Label>
      </View>
      <View style={s.bottom}>
        <SpecialPanel game={game} session={session} viewerId={human.id} connected={!multiplayer || multiplayer.connected} />
        <View style={s.turnLine}><View style={[s.dot, { backgroundColor: canAct ? colors.lime : colors.muted }]} /><Label style={s.turnText}>{finished ? 'ROUND COMPLETE' : pending ? active.id === human.id ? 'YOUR CHOICE' : `${active.name.toUpperCase()} IS CHOOSING` : canAct ? 'YOUR TURN' : `${active.name.toUpperCase()}'S TURN`}</Label>{!finished && <Label style={{ color: !unlimited && canAct && seconds < 2 ? colors.coral : colors.lime, fontSize: unlimited ? 12 : compact ? 16 : 22 }}>{unlimited ? 'UNLIMITED' : `${seconds.toFixed(1)}s`}</Label>}</View>
        {game.config.turnMs !== null && <View style={s.timerTrack}><View style={[s.timerFill, { width: `${Math.min(100, seconds * 1000 / game.config.turnMs * 100)}%` }]} /></View>}
        <View style={[s.actionRow, mobile && { gap: 32 }]}>
          <View style={s.action}><Button label="QUIT" tone="coral" disabled={!canAct} onPress={() => session.submit({ playerId: human.id, round: game.round, turnId: game.turnId, action: 'quit' })} /></View>
          <View style={s.action}><Button label={game.special?.dailyDouble.includes(human.id) ? 'HIT ×2' : 'HIT'} tone="lime" disabled={!canAct} onPress={() => session.submit({ playerId: human.id, round: game.round, turnId: game.turnId, action: 'hit' })} /></View>
        </View>
        <View style={s.handArea}><Hand cards={human.hand} width={cardWidth} /><Label style={[s.handLabel, compact && { fontSize: 12, marginTop: 7 }]}>{hidden ? 'YOUR HAND · ? POINTS' : human.status === 'bust' ? 'BUST · 0 POINTS' : human.status === 'quit' ? `BANKED · ${human.roundScore} POINTS` : `YOUR HAND · ${score.total} POINT${score.total === 1 ? '' : 'S'}`}</Label></View>
      </View>
    </View>
    <View style={[s.footer, compact && { paddingVertical: 6 }, mobile && s.mobileFooter]}><Label style={s.footerText}>YOU: {hidden ? '?' : human.total} PTS</Label><Label style={s.footerText}>PAIR = BUST   /   FLUSH +3   /   STRAIGHT +3   /   7 CARDS +5   /   13 CARDS = WIN</Label><Label style={s.footerText}>{multiplayer ? 'ONLINE PLAY' : 'LOCAL PLAY'}</Label></View>
    </ScrollView>
    {bonus && !hidden && !finished && <BonusToast key={bonus.id} messages={bonus.messages} />}
    {(panel !== null || finished) && <Modal visible transparent animationType="fade" onRequestClose={() => setPanel(null)}>
      <View style={s.scrim}><View style={[s.panel, { width: panel === 'scores' ? 1000 : 620, maxHeight: height - 28, maxWidth: width - 28 }]}>
        <ScrollView contentContainerStyle={s.panelContent}>
          {panel === 'leave' ? <><Label style={s.panelTitle}>Leave the table?</Label><Label style={s.panelText}>{multiplayer ? 'A bot will finish your current round.' : 'This local match will be lost.'}</Label><Button label="KEEP PLAYING" onPress={() => setPanel(null)} tone="lime" /><Button label="LEAVE MATCH" onPress={onLeave} tone="coral" /></>
          : inspected ? <><Label style={s.panelTitle}>{inspected.name}'s hand</Label><Hand cards={inspected.hand} width={compact ? 48 : 66} /><Label style={s.panelText}>{hidden ? 'Points hidden' : inspected.status === 'bust' ? 'Busted · 0 points' : `${scoreCards(inspected.hand).total} points in hand`}</Label><Button label="BACK TO TABLE" onPress={() => setPanel(null)} /></>
          : !hidden && (panel === 'scores' || panel === 'deck') ? <>
            <View style={s.panelTop}><Label style={s.panelTitle}>{panel === 'scores' ? 'Scoreboard' : 'The remaining deck'}</Label><Button label={panel === 'scores' ? 'DECK →' : '← SCORES'} small onPress={() => setPanel(panel === 'scores' ? 'deck' : 'scores')} /></View>
            {panel === 'scores' ? <><ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}><View style={{ flexGrow: 1, minWidth: (game.players.length + 1) * 76 }}><View style={s.scoreRow}><Label style={s.scoreCell}>TOTAL</Label>{game.players.map(p => <Label key={p.id} style={s.scoreCell}>{p.name}{'\n'}{p.total}</Label>)}</View>{game.history.map(r => <View key={r.round} style={s.scoreRow}><Label style={s.scoreCell}>R{r.round}</Label>{game.players.map(p => <Label key={p.id} style={s.scoreCell}>{r.scores[p.id]}</Label>)}</View>)}</View></ScrollView>{!game.history.length && <Label style={s.panelText}>Your first round is in play.</Label>}</>
              : <DeckInventory deck={game.deck} decksAdded={game.decksAdded} />}
            <Button label="BACK TO TABLE" onPress={() => setPanel(null)} />
          </> : finished ? <>
            <Label style={s.centerEyebrow}>{game.phase === 'game-over' ? 'THAT’S A WRAP' : `ROUND ${game.round} COMPLETE`}</Label>
            <Label style={s.panelTitle}>{game.phase === 'game-over' ? game.winnerIds.includes(human.id) ? game.winnerIds.length > 1 ? 'A shared victory!' : 'You win!' : `${game.players.find(p => p.id === game.winnerIds[0])?.name} wins!` : human.status === 'bust' ? 'Luck ran out.' : 'Points in the bank.'}</Label>
            {game.players.map(p => <View key={p.id} style={s.resultRow}><Label>{p.name}</Label><Label style={{ color: p.status === 'bust' ? colors.coral : colors.lime }}>{p.status === 'bust' ? 'BUST' : `+${p.roundScore}`}</Label><Label>{p.total} TOTAL</Label></View>)}
            {(!multiplayer || multiplayer.isHost) ? <Button label={game.phase === 'game-over' ? 'PLAY AGAIN' : 'NEXT ROUND →'} disabled={!!multiplayer && !multiplayer.connected} tone="lime" onPress={() => { if (game.phase === 'game-over' && !multiplayer) onLeave(); else session.advanceRound(); }} /> : <Label style={s.panelText}>Waiting for the host to start the next round.</Label>}
            {multiplayer && <><Label style={s.panelText}>{multiplayer.error ?? (!multiplayer.connected ? 'Reconnecting…' : '')}</Label><Button label="LEAVE TABLE" small onPress={onLeave} /></>}
            <Button label="VIEW SCOREBOARD" small onPress={() => setPanel('scores')} />
          </> : null}
        </ScrollView>
      </View></View>
    </Modal>}
  </View>;
}
const s = StyleSheet.create({
  tableScroll: { flex: 1, minHeight: 0 }, tableContent: { flexGrow: 1 },
  mobileHeader: { flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 16, gap: 12 },
  mobileHeaderRight: { justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  mobileArena: { flexGrow: 0, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 24 },
  mobileCenter: { flexGrow: 0, gap: 16, paddingVertical: 0 },
  mobileFooter: { flexDirection: 'column', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  table: { flex: 1, backgroundColor: colors.table }, header: { backgroundColor: colors.cream, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 18, gap: 20 },
  brand: { gap: 5 }, title: { color: colors.ink, fontSize: 34 }, or: { color: '#78935c', fontSize: 17 }, kicker: { color: '#61715a', fontSize: 9, letterSpacing: 2 }, headerRight: { flexDirection: 'row', alignItems: 'center', gap: 24 }, headerMeta: { color: colors.ink, fontSize: 12 }, exit: { color: colors.ink, fontSize: 12, textDecorationLine: 'underline', padding: 8 },
  arena: { flexGrow: 1, flexShrink: 0, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 }, tableLine: { position: 'absolute', top: 46, bottom: 80, left: 55, right: 55, borderColor: '#36594b', borderWidth: 1, borderRadius: 130 },
  opponents: { flexDirection: 'row', justifyContent: 'space-around', gap: 20 }, opponent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#102d28', borderWidth: 1, borderColor: colors.line }, activeOpponent: { borderColor: colors.lime, backgroundColor: '#294e3e' }, avatar: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a201d' }, avatarText: { color: colors.ink, fontSize: 23 }, playerName: { fontSize: 16 }, bot: { color: colors.muted, fontSize: 10 }, playerMeta: { fontSize: 10, color: colors.muted, marginTop: 7 }, badge: { fontSize: 9, minWidth: 62, textAlign: 'right' },
  center: { flexGrow: 1, flexShrink: 0, alignItems: 'center', justifyContent: 'center', minHeight: 160, paddingVertical: 24 }, centerEyebrow: { color: colors.muted, fontSize: 11, letterSpacing: 3, marginBottom: 16, textAlign: 'center' }, deckRow: { flexDirection: 'row', alignItems: 'center', gap: 24 }, deckStack: { borderBottomWidth: 5, borderRightWidth: 4, borderColor: '#0b211d' }, deckInfo: { gap: 14 }, deckCount: { color: colors.cream, fontSize: 24 }, subtle: { color: colors.muted, fontSize: 13 }, event: { color: colors.muted, fontSize: 14, marginTop: 22, textAlign: 'center' },
  bottom: { gap: 10, flexShrink: 0 }, turnLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10 }, dot: { width: 7, height: 7 }, turnText: { fontSize: 12, letterSpacing: 2 }, timerTrack: { height: 3, width: 160, alignSelf: 'center', backgroundColor: colors.line, marginBottom: 5 }, timerFill: { height: 3, backgroundColor: colors.lime }, actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: 4 }, action: { width: 120 }, handArea: { alignItems: 'center', width: '100%' }, handLabel: { marginTop: 14, fontSize: 14, color: colors.lime, textAlign: 'center' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', flexShrink: 0, justifyContent: 'space-between', gap: 8, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 24, paddingVertical: 13 }, footerText: { color: colors.muted, fontSize: 9, textAlign: 'center', lineHeight: 16 },
  scrim: { flex: 1, backgroundColor: '#061512dd', justifyContent: 'center', alignItems: 'center', padding: 14 }, panel: { backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.line, width: 620 }, panelContent: { padding: 24, gap: 18 }, panelTitle: { fontSize: 28, textAlign: 'center', color: colors.cream }, panelText: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' }, panelTop: { gap: 16 }, resultRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line }, scoreRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 10 }, scoreCell: { flex: 1, fontSize: 14, lineHeight: 24, textAlign: 'center' }, inventory: { gap: 8 }, inventorySuit: { fontSize: 12, color: colors.lime }, inventoryRanks: { fontSize: 17, lineHeight: 24 }, smallPrint: { color: colors.muted, fontSize: 11, textAlign: 'center' }, rotate: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
});
