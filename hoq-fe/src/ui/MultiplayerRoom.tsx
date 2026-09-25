import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import type { RemoteSession } from '../session/remoteSession';
import { GameTable } from './GameTable';
import { Button, Label } from './components';
import { RuleControls } from './RuleControls';
import { colors } from './theme';

export function MultiplayerRoom({ session, onLeave }: { session: RemoteSession; onLeave(): void }) {
  const state = useSyncExternalStore(session.subscribe, session.getRemoteSnapshot, session.getRemoteSnapshot);
  const host = !!state.seatId && state.seatId === state.hostSeatId;
  const playing = state.game?.players.some(p => p.id === state.seatId);
  useEffect(() => {
    if (playing) return;
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') session.resume(); });
    return () => subscription.remove();
  }, [session, playing]);
  if (playing) return <GameTable session={session} onLeave={onLeave} />;
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 20, width: '100%', maxWidth: 650, alignSelf: 'center' }}>
    <Label style={{ fontSize: 28 }}>{state.game ? 'Waiting for the next round' : 'Your multiplayer table'}</Label>
    <Label selectable style={{ color: colors.lime, fontSize: 24 }}>JOIN CODE: {state.joinCode || '…'}</Label>
    <Label>{host ? 'You are the host.' : `Host: ${state.members.find(m => m.seatId === state.hostSeatId)?.name ?? 'Connecting…'}`}</Label>
    {!state.connected && <Label>Connecting to the table…</Label>}
    {state.error && <Label accessibilityLiveRegion="polite" style={{ color: colors.coral }}>{state.error}</Label>}
    <Label>{state.members.length} / {state.maxPlayers} players</Label>
    {state.members.map(member => <Label key={member.seatId}>{member.name}{member.seatId === state.seatId ? ' (you)' : ''}{member.seatId === state.hostSeatId ? ' · HOST' : ''}{!member.connected ? ' · DISCONNECTED' : member.waiting ? ' · WAITING' : ''}</Label>)}
    {state.game && <View style={{ gap: 8 }}><Label>ROUND {state.game.round} · {state.game.phase === 'playing' ? `${state.game.players[state.game.activeIndex].name}'s turn` : 'Round complete'}</Label>{state.game.players.map(player => <Label key={player.id}>{player.name}: {player.total} points · {player.hand.length} cards · {player.status}</Label>)}</View>}
    {host && (!state.game || state.game.phase === 'game-over') ? <RuleControls config={state.config} disabled={!state.connected} onChange={session.configure} /> :
      <Label>First to {state.config.target} · {state.config.turnMs === null ? 'Unlimited turns' : `${state.config.turnMs / 1000} seconds per turn`}</Label>}
    {host ? <Button label={state.game ? 'START NEXT ROUND' : 'START GAME'} tone="lime" disabled={!state.connected || state.members.filter(m => !m.departed).length < 2 || state.game?.phase === 'playing'} onPress={session.advanceRound} /> : <Label>The host starts the game and each new round.</Label>}
    <Button label="LEAVE TABLE" onPress={onLeave} />
  </ScrollView>;
}
