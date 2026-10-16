import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { funRules } from './src/game/specials/framework';
import type { GameCard, SpecialCardId } from './src/game/types';
import { ALL_SPECIAL_CARDS } from './src/game/specials/selection';
import type { BotPolicy } from './src/game/bots';
import { BOT_COUNTS, TURN_OPTIONS, createLocalSeats } from './src/game/setup';
import { createLocalSession } from './src/session/localSession';
import type { GameSession } from './src/session/types';
import { GameTable } from './src/ui/GameTable';
import { Button, Label, PlayingCard } from './src/ui/components';
import { colors } from './src/ui/theme';
import { AppearanceProvider, useAppearance } from './src/appearance/AppearanceProvider';
import { AppearanceNotice, CustomizationPanel } from './src/ui/CustomizationPanel';
import { SpecialCardGuide } from './src/ui/SpecialCardGuide';
import { HowToPlay } from './src/ui/HowToPlay';
import { createRemoteSession, type RemoteSession, type Socket } from './src/session/remoteSession';
import { identityStore, backendUrl } from './src/session/platformStorage';
import type { Identity } from './src/session/identityStore';
import { randomUUID } from 'expo-crypto';
import { MultiplayerRoom } from './src/ui/MultiplayerRoom';

export default function App() {
  return <AppearanceProvider><Home /></AppearanceProvider>;
}
function Home() {
  const { width } = useWindowDimensions();
  const mobile = width < 1024;
  const { uiFontFamily: fontFamily } = useAppearance();
  const [customizing, setCustomizing] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [target, setTarget] = useState(30);
  const [seconds, setSeconds] = useState<number | null>(10);
  const [botCount, setBotCount] = useState(2);
  const [enabledSpecials, setEnabledSpecials] = useState<SpecialCardId[]>(() => [...ALL_SPECIAL_CARDS]);
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
        mode: resume ? 'resume' : mode === 'host' ? 'host' : 'join', joinCode, config: { target, turnMs: seconds === null ? null : seconds * 1000, enabledSpecials },
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
    const next = createLocalSession({ rules: funRules, bot: (() => 'hit') as BotPolicy<GameCard>, config: { target, turnMs: seconds === null ? null : seconds * 1000, enabledSpecials },
      seats: createLocalSeats(botCount) });
    sessionRef.current = next; setSession(next);
  }
  function leave() { sessionRef.current?.dispose(); sessionRef.current = null; setSession(null); }
  return <SafeAreaProvider><SafeAreaView style={s.root}><StatusBar hidden />
    {remote ? <MultiplayerRoom session={remote} onLeave={() => { void leaveOnline(); }} /> : session ? <GameTable session={session} onLeave={leave} /> : <>
    <View style={s.modeBar}>{(['solo', 'host', 'join'] as const).map(value => <Button key={value} label={value.toUpperCase()} selected={mode === value} tone={mode === value ? 'lime' : 'cream'} onPress={() => setMode(value)} />)}</View>
    <ScrollView style={s.setupScroll} contentContainerStyle={[s.homeContent, mobile && s.homeContentMobile]}>
      <View style={[s.setup, mobile && s.setupMobile]}>
      <View style={[s.intro, mobile && s.mobileSection]}><Label style={[s.logo, mobile && { fontSize: 40 }]}>HIT <Label style={s.or}>or</Label> QUIT</Label>
        <View style={s.sample}><PlayingCard card={{ id: 'sample-a', kind: 'standard', rank: 1, suit: 'spades' }} width={60} /><PlayingCard card={{ id: 'sample-k', kind: 'standard', rank: 13, suit: 'hearts' }} width={60} /><PlayingCard width={60} /></View>
        <Button label="CUSTOMIZE CARDS & FONT" onPress={() => setCustomizing(true)} />
        <AppearanceNotice />
      </View>
      <View style={[s.setupPanel, mobile && [s.mobileSection, s.mobilePanel]]}><Label style={s.panelTitle}>House Rules</Label>
        {mode !== 'solo' && <><Label style={s.fieldLabel}>YOUR NAME</Label><TextInput accessibilityLabel="Your name" style={[s.input, { fontFamily }]} value={name} onChangeText={setName} maxLength={40} />{mode === 'join' && <><Label style={s.fieldLabel}>JOIN CODE</Label><TextInput accessibilityLabel="Join code" style={[s.input, { fontFamily }]} value={joinCode} onChangeText={value => setJoinCode(value.toUpperCase())} maxLength={6} autoCapitalize="characters" autoCorrect={false} /></>}</>}
        {mode !== 'join' && <>
        <Label style={s.fieldLabel}>TARGET SCORE</Label><View style={[s.choices, mobile && s.mobileChoices]}>{[15, 30, 50].map(value => <Button key={value} label={`${value} PTS`} small={!mobile} tone={target === value ? 'lime' : 'cream'} onPress={() => setTarget(value)} />)}</View>
        <Label style={s.fieldLabel}>TIME PER TURN</Label><View style={[s.choices, mobile && s.mobileChoices]}>{TURN_OPTIONS.map(value => <Button key={value ?? 'unlimited'} label={value === null ? 'UNLIMITED' : `${value} SEC`} small={!mobile} tone={seconds === value ? 'lime' : 'cream'} onPress={() => setSeconds(value)} />)}</View>
        </>}
        {mode === 'solo' && <><Label style={s.fieldLabel}>NUMBER OF BOTS</Label><View style={s.choices}>{BOT_COUNTS.map(value => <View key={value} style={mobile && s.mobileBotOption}><Button label={`${value}`} small={!mobile} tone={botCount === value ? 'lime' : 'cream'} onPress={() => setBotCount(value)} /></View>)}</View></>}
        {mode === 'solo' ? <Button label="DEAL ME IN →" tone="lime" onPress={start} /> : <Button label={busy ? 'CONNECTING…' : mode === 'host' ? 'CREATE TABLE' : 'JOIN TABLE'} tone="lime" disabled={busy || !name.trim() || (mode === 'join' && joinCode.length !== 6)} onPress={() => { void online(); }} />}
        {saved?.sessionId && <Button label="REJOIN SAVED TABLE" disabled={busy} onPress={() => { void online(true); }} />}
        {!!onlineError && <Label style={s.rules}>{onlineError}</Label>}
      </View>
      </View>
      <HowToPlay />
      <SpecialCardGuide selection={mode === 'join' ? undefined : { enabled: enabledSpecials, onChange: setEnabledSpecials, disabled: busy }} />
    </ScrollView>
    {customizing && <CustomizationPanel onClose={() => setCustomizing(false)} />}</>}
  </SafeAreaView></SafeAreaProvider>;
}
const s = StyleSheet.create({
  modeBar: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, padding: 16 },
  input: { color: colors.cream, borderWidth: 1, borderColor: colors.line, padding: 12, fontSize: 18 },
  root: { flex: 1, backgroundColor: colors.table },
  homeContent: { flexGrow: 1, padding: 28, gap: 32, paddingBottom: 40 },
  homeContentMobile: { padding: 16, gap: 24, paddingBottom: 32 },
  setupScroll: { flex: 1, minHeight: 0, width: '100%' },
  setup: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 48, backgroundColor: colors.table },
  setupMobile: { flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'flex-start', alignItems: 'stretch', gap: 24 },
  mobileSection: { width: '100%', maxWidth: 520, alignSelf: 'center', flexShrink: 0 },
  mobilePanel: { padding: 16 },
  mobileChoices: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: 10 },
  mobileBotOption: { flexBasis: '30%', flexGrow: 1 },
  intro: { width: 390, maxWidth: '100%', flexShrink: 0, gap: 20 },
  logo: { fontSize: 53 }, or: { fontSize: 26, color: colors.coral },
  sample: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 4 },
  setupPanel: { width: 390, maxWidth: '100%', flexShrink: 0, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line, padding: 24, gap: 16 },
  panelTitle: { fontSize: 24 }, fieldLabel: { fontSize: 11, color: colors.lime, letterSpacing: 2, marginTop: 4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rules: { fontSize: 12, lineHeight: 23, color: colors.muted },
});
