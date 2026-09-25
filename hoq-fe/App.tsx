import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { standardBot } from './src/game/bots';
import { standardRules } from './src/game/standardRules';
import { funRules } from './src/game/specials/framework';
import type { GameCard } from './src/game/types';
import type { BotPolicy } from './src/game/bots';
import { BOT_COUNTS, TURN_OPTIONS, createLocalSeats } from './src/game/setup';
import { createLocalSession } from './src/session/localSession';
import type { GameSession } from './src/session/types';
import { GameTable } from './src/ui/GameTable';
import { Button, Label, PlayingCard } from './src/ui/components';
import { cardTheme, colors } from './src/ui/theme';
import { createRemoteSession, type RemoteSession, type Socket } from './src/session/remoteSession';
import { identityStore, backendUrl } from './src/session/platformStorage';
import type { Identity } from './src/session/identityStore';
import { randomUUID } from 'expo-crypto';
import { MultiplayerRoom } from './src/ui/MultiplayerRoom';

export default function App() {
  const { width } = useWindowDimensions();
  const mobile = width < 1024;
  const [fontsLoaded, fontError] = useFonts({ Classic: cardTheme.fontSource });
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [target, setTarget] = useState(30);
  const [seconds, setSeconds] = useState<number | null>(10);
  const [botCount, setBotCount] = useState(2);
  const [mode, setMode] = useState<'solo' | 'host' | 'join'>('solo');
  const [remote, setRemote] = useState<RemoteSession | null>(null);
  const remoteRef = useRef<RemoteSession | null>(null);
  const [saved, setSaved] = useState<Identity | null>(null);
  const [name, setName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  useEffect(() => {
    let mounted = true;
    void identityStore.load().then(value => { if (mounted) setSaved(value); }).catch(() => { if (mounted) setOnlineError('Session storage is unavailable. Solo play is still available.'); });
    return () => { mounted = false; remoteRef.current?.dispose(); };
  }, []);
  async function online(resume = false) {
    setBusy(true); setOnlineError('');
    try {
      const identity = await identityStore.load();
      if (!resume) { delete identity.sessionId; delete identity.endpoint; await identityStore.save(identity); }
      const next = createRemoteSession({ endpoint: resume && identity.endpoint ? identity.endpoint : backendUrl(), identity, name: name.trim(),
        mode: resume ? 'resume' : mode === 'host' ? 'host' : 'join', joinCode, config: { target, turnMs: seconds === null ? null : seconds * 1000 },
        uuid: randomUUID, connect: url => new WebSocket(url) as unknown as Socket,
        save: async value => { await identityStore.save(value); setSaved(value); },
      });
      remoteRef.current = next; setRemote(next);
    } catch (error) { setOnlineError(error instanceof Error ? error.message : 'Could not open multiplayer.'); }
    finally { setBusy(false); }
  }
  async function leaveOnline() {
    const current = remoteRef.current;
    try { await current?.leave(); setSaved(await identityStore.load()); }
    catch { setOnlineError('Could not clear the saved session.'); }
    finally { current?.dispose(); remoteRef.current = null; setRemote(null); }
  }
  useEffect(() => () => sessionRef.current?.dispose(), []);
  function start() {
    sessionRef.current?.dispose();
    const next = createLocalSession({ rules: funRules, bot: (() => 'hit') as BotPolicy<GameCard>, config: { target, turnMs: seconds === null ? null : seconds * 1000 },
      seats: createLocalSeats(botCount) });
    sessionRef.current = next; setSession(next);
  }
  function leave() { sessionRef.current?.dispose(); sessionRef.current = null; setSession(null); }
  if (!fontsLoaded && !fontError) return <View style={s.loading} />;
  return <SafeAreaProvider><SafeAreaView style={s.root}><StatusBar hidden />
    {remote ? <MultiplayerRoom session={remote} onLeave={() => { void leaveOnline(); }} /> : session ? <GameTable session={session} onLeave={leave} /> : <>
    <View style={s.modeBar}>{(['solo', 'host', 'join'] as const).map(value => <Button key={value} label={value.toUpperCase()} selected={mode === value} tone={mode === value ? 'lime' : 'cream'} onPress={() => setMode(value)} />)}</View>
    <ScrollView style={s.setupScroll} contentContainerStyle={[s.setup, mobile && s.setupMobile]}>
      <View style={[s.intro, mobile && s.mobileSection]}><Label style={s.eyebrow}>THE JUST-ONE-MORE CARD GAME</Label><Label style={[s.logo, mobile && { fontSize: 40 }]}>HIT <Label style={s.or}>or</Label> QUIT</Label><Label style={s.tagline}>Feeling lucky?</Label><Label style={s.description}>Take a card. Chase a bonus. Stop before a pair sends you home empty-handed.</Label>
        <View style={s.sample}><PlayingCard card={{ id: 'sample-a', kind: 'standard', rank: 1, suit: 'spades' }} width={60} /><PlayingCard card={{ id: 'sample-k', kind: 'standard', rank: 13, suit: 'hearts' }} width={60} /><PlayingCard width={60} /></View>
        <Label style={s.offline}>{mode === 'solo' ? `ONE PLAYER + ${botCount} BOTS  ·  OFFLINE` : 'PLAY TOGETHER · ONLINE'}</Label>
      </View>
      <View style={[s.setupPanel, mobile && [s.mobileSection, s.mobilePanel]]}><Label style={s.panelTitle}>Your table is ready.</Label><Label style={s.description}>{mode === 'solo' ? `You against ${botCount} bots. First to the target wins.` : mode === 'host' ? 'Choose the rules, invite friends, then start the game.' : 'Enter the code shared by your host.'}</Label>
        {mode !== 'solo' && <><Label style={s.fieldLabel}>YOUR NAME</Label><TextInput accessibilityLabel="Your name" style={s.input} value={name} onChangeText={setName} maxLength={40} />{mode === 'join' && <><Label style={s.fieldLabel}>JOIN CODE</Label><TextInput accessibilityLabel="Join code" style={s.input} value={joinCode} onChangeText={value => setJoinCode(value.toUpperCase())} maxLength={6} autoCapitalize="characters" autoCorrect={false} /></>}</>}
        {mode !== 'join' && <>
        <Label style={s.fieldLabel}>TARGET SCORE</Label><View style={[s.choices, mobile && s.mobileChoices]}>{[15, 30, 50].map(value => <Button key={value} label={`${value} PTS`} small={!mobile} tone={target === value ? 'lime' : 'cream'} onPress={() => setTarget(value)} />)}</View>
        <Label style={s.fieldLabel}>TIME PER TURN</Label><View style={[s.choices, mobile && s.mobileChoices]}>{TURN_OPTIONS.map(value => <Button key={value ?? 'unlimited'} label={value === null ? 'UNLIMITED' : `${value} SEC`} small={!mobile} tone={seconds === value ? 'lime' : 'cream'} onPress={() => setSeconds(value)} />)}</View>
        </>}
        {mode === 'solo' && <><Label style={s.fieldLabel}>NUMBER OF BOTS</Label><View style={s.choices}>{BOT_COUNTS.map(value => <View key={value} style={mobile && s.mobileBotOption}><Button label={`${value}`} small={!mobile} tone={botCount === value ? 'lime' : 'cream'} onPress={() => setBotCount(value)} /></View>)}</View></>}
        <Label style={s.rules}>1 point per card · Flush +3 · Straight +3{ '\n' }Seven cards +5. Thirteen safe cards wins!{ '\n' }One normal card to start. Special cards are in play.{ '\n' }A pair busts. {mode === 'join' ? 'The host chooses the target and turn timer.' : seconds === null ? 'Take your time. No automatic hits.' : 'Time runs out? You hit or auto-choose.'}</Label>
        {mode === 'solo' ? <Button label="DEAL ME IN →" tone="lime" onPress={start} /> : <Button label={busy ? 'CONNECTING…' : mode === 'host' ? 'CREATE TABLE' : 'JOIN TABLE'} tone="lime" disabled={busy || !name.trim() || (mode === 'join' && joinCode.length !== 6)} onPress={() => { void online(); }} />}
        {saved?.sessionId && <Button label="REJOIN SAVED TABLE" disabled={busy} onPress={() => { void online(true); }} />}
        {!!onlineError && <Label style={s.rules}>{onlineError}</Label>}
        {fontError && <Label style={s.rules}>Classic font could not load. Using the system font.</Label>}
      </View>
    </ScrollView></>}
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({
  modeBar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, padding: 16 },
  input: { color: colors.cream, borderWidth: 1, borderColor: colors.line, padding: 12, fontSize: 18 },
  root: { flex: 1, backgroundColor: colors.table },
  loading: { flex: 1, backgroundColor: colors.table },
  setupScroll: { flex: 1, minHeight: 0, width: '100%' },
  setup: { flexGrow: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 48, padding: 28, backgroundColor: colors.table },
  setupMobile: { flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: 'stretch', padding: 16, paddingBottom: 32, gap: 24 },
  mobileSection: { width: '100%', maxWidth: 520, alignSelf: 'center', flexShrink: 0 },
  mobilePanel: { padding: 16 },
  mobileChoices: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: 10 },
  mobileBotOption: { flexBasis: '30%', flexGrow: 1 },
  intro: { width: 390, maxWidth: '100%', flexShrink: 0, gap: 20 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: colors.lime },
  logo: { fontSize: 53 }, or: { fontSize: 26, color: colors.coral },
  tagline: { fontSize: 28, color: colors.lime }, description: { fontSize: 15, lineHeight: 24, color: colors.muted },
  sample: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 4 },
  offline: { fontSize: 10, color: colors.muted, letterSpacing: 1 },
  setupPanel: { width: 390, maxWidth: '100%', flexShrink: 0, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line, padding: 24, gap: 16 },
  panelTitle: { fontSize: 24 }, fieldLabel: { fontSize: 11, color: colors.lime, letterSpacing: 2, marginTop: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rules: { fontSize: 12, lineHeight: 23, color: colors.muted },
});
