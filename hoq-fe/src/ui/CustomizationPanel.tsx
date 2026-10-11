import React, { useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType, type ImageStyle } from 'react-native';
import { ensureFont, useAppearance } from '../appearance/AppearanceProvider';
import { backAssets, frontAssets } from '../appearance/assets';
import { backs, fonts, frontSets, fontFamily, type FontId } from '../appearance/catalog';
import { Button, Label, PlayingCard } from './components';
import { colors } from './theme';

function Choice({ name, selected, disabled, onPress, children, fullWidth = false }: {
  name: string; selected: boolean; disabled: boolean; onPress(): void; children: React.ReactNode; fullWidth?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected, disabled }}
    disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={({ pressed }) => [s.choice, fullWidth && s.frontChoice, selected && s.selected, focused && s.focused, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
    {children}<View style={s.choiceLabel}><Label style={s.optionName}>{name}</Label><Label style={s.selection}>{selected ? '✓ Selected' : 'Choose'}</Label></View>
  </Pressable>;
}
function Thumbnail({ source }: { source: ImageSourcePropType }) {
  return <Image source={source} resizeMode="contain" style={[{ width: 36, height: 54 }, Platform.OS === 'web' && ({ imageRendering: 'pixelated' } as ImageStyle)]} />;
}
function FontSample({ id }: { id: FontId }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void ensureFont(id).then(() => { if (active) setLoaded(true); }, () => {});
    return () => { active = false; };
  }, [id]);
  const { activeFont, uiFontFamily } = useAppearance();
  return <Label style={[s.fontSample, { fontFamily: loaded || activeFont === id ? fontFamily(id) : uiFontFamily }]}>A 10 J Q K</Label>;
}
export function AppearanceNotice() {
  const { storageError, fontError, failedFont, selectFont } = useAppearance();
  if (!storageError && !fontError) return null;
  return <View style={{ gap: 8 }}><Label accessibilityLiveRegion="polite" style={s.notice}>{[storageError, fontError].filter(Boolean).join(' ')}</Label>
    {failedFont && <Button label="RETRY FONT" small onPress={() => { void selectFont(failedFont); }} />}</View>;
}
export function CustomizationPanel({ onClose }: { onClose(): void }) {
  const { height, width } = useWindowDimensions();
  const { preferences, hydrated, pendingFont, selectFront, selectBack, selectFont, reset } = useAppearance();
  const previewWidth = Math.max(24, Math.min(height < 480 ? 40 : 60, Math.floor((Math.min(800, width - 32) - 50) / 5)));
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={s.scrim}><View accessibilityViewIsModal style={[s.panel, { maxHeight: height - 48 }]}>
      <View style={s.header}>
        <View style={s.actions}><Button label="RESET TO DEFAULTS" small disabled={!hydrated} onPress={reset} /><Button label="DONE" small onPress={onClose} /></View>
        <View style={s.previewCards}>
          <PlayingCard card={{ id: 'preview-spades', kind: 'standard', suit: 'spades', rank: 1 }} width={previewWidth} />
          <PlayingCard card={{ id: 'preview-clubs', kind: 'standard', suit: 'clubs', rank: 10 }} width={previewWidth} />
          <PlayingCard card={{ id: 'preview-hearts', kind: 'standard', suit: 'hearts', rank: 12 }} width={previewWidth} />
          <PlayingCard card={{ id: 'preview-diamonds', kind: 'standard', suit: 'diamonds', rank: 13 }} width={previewWidth} />
          <PlayingCard width={previewWidth} />
        </View>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {!hydrated && <Label accessibilityLiveRegion="polite" style={s.notice}>Restoring your choices…</Label>}
        <AppearanceNotice />
        <Label accessibilityRole="header" style={s.heading}>Card fronts</Label>
        <View style={s.frontList}>{frontSets.map(option => <Choice fullWidth key={option.id} name={option.name} selected={preferences.frontSetId === option.id} disabled={!hydrated} onPress={() => selectFront(option.id)}>
          <View style={s.thumbnails}>{Object.values(frontAssets[option.id]).map((source, index) => <Thumbnail key={index} source={source} />)}</View>
        </Choice>)}</View>
        <Label accessibilityRole="header" style={s.heading}>Card backs</Label>
        <View style={s.grid}>{backs.map(option => <Choice key={option.id} name={option.name} selected={preferences.backId === option.id} disabled={!hydrated} onPress={() => selectBack(option.id)}>
          <Thumbnail source={backAssets[option.id]} />
        </Choice>)}</View>
        <Label accessibilityRole="header" style={s.heading}>Rank font</Label>
        {pendingFont && <Label accessibilityLiveRegion="polite" style={s.notice}>Loading {fonts.find(font => font.id === pendingFont)!.name}…</Label>}
        <View style={s.grid}>{fonts.map(option => <Choice key={option.id} name={option.name} selected={preferences.fontId === option.id} disabled={!hydrated} onPress={() => { void selectFont(option.id); }}>
          <FontSample id={option.id} />
        </Choice>)}</View>
      </ScrollView>
    </View></View>
  </Modal>;
}
const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#061512dd', padding: 16, alignItems: 'center', justifyContent: 'center' },
  panel: { width: '100%', maxWidth: 800, backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.line, flexShrink: 1 },
  header: { padding: 12, gap: 12, flexShrink: 0, backgroundColor: colors.table, borderBottomWidth: 1, borderColor: colors.line },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  scroll: { minHeight: 0, flexShrink: 1 }, content: { padding: 16, gap: 16 },
  heading: { color: colors.lime, fontSize: 20, marginTop: 8 }, notice: { color: colors.coral, fontSize: 14, lineHeight: 21 },
  previewCards: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  frontList: { gap: 10 }, frontChoice: { width: '100%', flexBasis: 'auto', flexGrow: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  choiceLabel: { gap: 8, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choice: { flexGrow: 1, flexBasis: 160, minWidth: 0, padding: 12, gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.table, borderWidth: 2, borderColor: colors.line },
  selected: { borderColor: colors.lime, backgroundColor: colors.tableLight }, focused: { borderColor: colors.coral },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 },
  optionName: { color: colors.cream, fontSize: 14, textAlign: 'center' }, selection: { color: colors.lime, fontSize: 12 },
  fontSample: { color: colors.cream, fontSize: 23, textAlign: 'center', minHeight: 36 },
});
