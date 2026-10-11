import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { isLoaded, loadAsync } from 'expo-font';
import { backAssets, fontAssets, frontAssets } from './assets';
import { fontFamily, type FontId } from './catalog';
import { createAppearanceController } from './controller';
import { preferenceStore } from './platformStorage';

const pending = new Map<FontId, Promise<void>>();
export function ensureFont(id: FontId): Promise<void> {
  if (isLoaded(fontFamily(id))) return Promise.resolve();
  const existing = pending.get(id);
  if (existing) return existing;
  const request = loadAsync(fontFamily(id), fontAssets[id]).finally(() => { pending.delete(id); });
  pending.set(id, request);
  return request;
}
const AppearanceContext = createContext<ReturnType<typeof useAppearanceState> | null>(null);
function useAppearanceState() {
  const [controller] = useState(() => createAppearanceController(preferenceStore, ensureFont));
  const [uiFontFamily, setUiFontFamily] = useState<string | undefined>(() => isLoaded(fontFamily('classic')) ? fontFamily('classic') : undefined);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.initialize(); }, [controller]);
  useEffect(() => {
    let mounted = true;
    void ensureFont('classic').then(() => { if (mounted) setUiFontFamily(fontFamily('classic')); }, () => {});
    return () => { mounted = false; };
  }, []);
  return { ...state, selectFront: controller.selectFront, selectBack: controller.selectBack, selectFont: controller.selectFont,
    reset: controller.reset, uiFontFamily, rankFontFamily: state.activeFont ? fontFamily(state.activeFont) : uiFontFamily,
    fronts: frontAssets[state.preferences.frontSetId], back: backAssets[state.preferences.backId] };
}
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const appearance = useAppearanceState();
  return <AppearanceContext.Provider value={appearance}>{children}</AppearanceContext.Provider>;
}
export function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance) throw new Error('AppearanceProvider is required.');
  return appearance;
}
