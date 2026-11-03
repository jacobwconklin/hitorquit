import { MatchResults } from './MatchResults';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, ScrollView, View } from 'react-native';
import type { RemoteSession } from '../session/remoteSession';
import { GameTable } from './GameTable';
import { Button, Label } from './components';
import { RuleControls } from './RuleControls';
import { colors } from './theme';
import { SpecialCardGuide } from './SpecialCardGuide';
import { DEFAULT_SPECIAL_CARDS } from '../game/specials/selection';
import { CustomizationPanel, AppearanceNotice } from './CustomizationPanel';
import { HowToPlay } from './HowToPlay';

function TableControls({ session, onLeave }: { session: RemoteSession; onLeave(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getRemoteSnapshot, session.getRemoteSnapshot);
  const [confirm, setConfirm] = useState<'end' | 'leave' | string | null>(null);
  const host = !!state.seatId && state.seatId === state.hostSeatId;
  const canEditBots = !state.game || state.game.phase === 'game-over';
  if (confirm) return <View style={{ gap: 16 }}>
    <Label style={{ fontSize: 24 }}>{confirm === 'end' ? 'End the game for everyone?' : confirm === 'leave' ? 'Leave this table?' : 'Remove this player?'}</Label>
    <Label>{confirm === 'end' ? 'The current game will stop for all players. Everyone returns to the menu, and you can change the rules and replay with the same code.' : confirm === 'leave' ? 'This releases your seat. To step away temporarily, just close or background the app instead. If you are the host, another player will become host.' : 'They will be removed from the table. A bot will finish their current round.'}</Label>
    <Button label="CANCEL" onPress={() => setConfirm(null)} />
    <Button label="CONFIRM" tone="coral" disabled={!state.connected && confirm !== 'leave'} onPress={() => {
      if (confirm === 'end') session.endGame(); else if (confirm === 'leave') onLeave(); else session.kick(confirm);
      setConfirm(null);
    }} />
  </View>;
  return <View style={{ gap: 12 }}>
    <Label>{state.members.length} / {state.maxPlayers} seats · {state.members.filter(m => !m.bot).length} players · {state.members.filter(m => m.bot).length} bots</Label>
    {state.members.map(member => <View key={member.seatId} style={{ gap: 6 }}>
      <Label>{member.name}{member.bot ? ' · BOT' : ''}{member.seatId === state.seatId ? ' (you)' : ''}{member.seatId === state.hostSeatId ? ' · HOST' : ''}{!member.connected && !member.bot ? ' · DISCONNECTED' : ''}</Label>
      {host && member.seatId !== state.seatId && (!member.bot || canEditBots) && <Button small label={`REMOVE ${member.name}`} disabled={!state.connected} onPress={() => member.bot ? session.kick(member.seatId) : setConfirm(member.seatId)} />}
    </View>)}
    {host && state.supportsBots && canEditBots && <Button label="ADD BOT" disabled={!state.connected || state.members.length >= state.maxPlayers} onPress={session.addBot} />}
    {host && state.game && state.game.phase !== 'game-over' && <Button label="END GAME FOR EVERYONE" tone="coral" disabled={!state.connected} onPress={() => setConfirm('end')} />}
    <Button label="LEAVE TABLE" onPress={() => setConfirm('leave')} />
  </View>;
}

export function MultiplayerRoom({ session, onLeave }: { session: RemoteSession; onLeave(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getRemoteSnapshot, session.getRemoteSnapshot);
  const [customizing, setCustomizing] = useState(false);
  const host = !!state.seatId && state.seatId === state.hostSeatId;
  const playing = state.game && state.game.phase !== 'game-over' && state.game.players.some(p => p.id === state.seatId);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') session.resume(); });
    const visible = () => { if (document.visibilityState === 'visible') session.resume(); };
    const focus = () => session.resume();
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', visible); window.addEventListener('pageshow', focus); window.addEventListener('online', focus); }
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', visible); window.removeEventListener('pageshow', focus); window.removeEventListener('online', focus); }
    };
  }, [session]);
  const controls = <TableControls session={session} onLeave={onLeave} />;
  if (playing) return <GameTable session={session} onLeave={onLeave} tableControls={controls} />;
  return <>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 20, width: '100%', maxWidth: 800, alignSelf: 'center' }}>
      {state.game?.phase === 'game-over' && <MatchResults game={state.game} localPlayerId={state.seatId} />}
      <Label style={{ fontSize: 32 }}>{state.game ? 'Another hand?' : 'HIT or QUIT'}</Label>
      <Label style={{ fontSize: 24 }}>{state.game ? 'Make it a rematch. Choose your next rules below.' : 'Your multiplayer table'}</Label>
      <Button label="CUSTOMIZE CARDS & FONT" onPress={() => setCustomizing(true)} />
      <AppearanceNotice />
      <Label selectable style={{ color: colors.lime, fontSize: 24 }}>JOIN CODE: {state.joinCode || '…'}</Label>
      <Label>{host ? 'You are the host.' : `Host: ${state.members.find(m => m.seatId === state.hostSeatId)?.name ?? 'Connecting…'}`}</Label>
      {!state.connected && <Label>Not connected to the table.</Label>}
      {state.error && <Label accessibilityLiveRegion="polite" style={{ color: colors.coral }}>{state.error}</Label>}
      {controls}
      <Label style={{ fontSize: 24 }}>House Rules</Label>
      {host ? <RuleControls config={state.config} disabled={!state.connected || state.configuring} onChange={session.configure} /> : <Label>First to {state.config.target} · {state.config.turnMs === null ? 'Unlimited turns' : `${state.config.turnMs / 1000} seconds per turn`}</Label>}
      {host ? <Button label={state.game ? 'PLAY AGAIN' : 'START GAME'} tone="lime" disabled={!state.connected || state.configuring || state.members.length < 2} onPress={session.advanceRound} /> : <Label>Customize your cards while the host chooses rules and starts the next game.</Label>}
      <HowToPlay />
      <SpecialCardGuide selection={{ enabled: state.config.enabledSpecials ?? DEFAULT_SPECIAL_CARDS, onChange: host ? enabledSpecials => session.configure({ ...state.config, enabledSpecials }) : undefined, disabled: !state.connected || state.configuring }} />
    </ScrollView>
    {customizing && <CustomizationPanel onClose={() => setCustomizing(false)} />}
  </>;
}
