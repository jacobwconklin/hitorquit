import { defaults, fonts, type AppearancePreferences, type BackId, type FontId, type FrontSetId } from './catalog';
import type { createPreferenceStore } from './preferenceStore';

interface AppearanceState {
  preferences: AppearancePreferences; hydrated: boolean; activeFont?: FontId;
  pendingFont?: FontId; failedFont?: FontId; fontError: string; storageError: string;
}
// Pure async state machine: font requests and storage races can be tested without a renderer.
export function createAppearanceController(store: ReturnType<typeof createPreferenceStore>, loadFont: (id: FontId) => Promise<void>) {
  let state: AppearanceState = { preferences: { ...defaults }, hydrated: false, fontError: '', storageError: '' };
  const listeners = new Set<() => void>();
  let initialization: Promise<void> | undefined;
  let fontRequest = 0, saveRequest = 0;
  function update(patch: Partial<AppearanceState>) { state = { ...state, ...patch }; listeners.forEach(listener => listener()); }
  function save() {
    const request = ++saveRequest;
    void store.save(state.preferences).then(() => {
      if (request === saveRequest) update({ storageError: '' });
    }, () => {
      if (request === saveRequest) update({ storageError: 'Your choices work for now, but could not be saved on this device.' });
    });
  }
  async function selectFont(id: FontId) {
    if (!state.hydrated) return;
    const request = ++fontRequest;
    update({ pendingFont: id, failedFont: undefined, fontError: '' });
    try {
      await loadFont(id);
      if (request !== fontRequest) return;
      update({ activeFont: id, pendingFont: undefined, preferences: { ...state.preferences, fontId: id } });
      save();
    } catch {
      if (request !== fontRequest) return;
      update({ pendingFont: undefined, failedFont: id, fontError: `${fonts.find(font => font.id === id)!.name} could not load. Keeping the current font.` });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    initialize() {
      return initialization ??= (async () => {
        const classic = loadFont('classic').then(() => true, () => false);
        let preferences = { ...defaults };
        try { preferences = await store.load(); }
        catch { update({ storageError: 'Saved appearance could not be restored. You can still choose an appearance and play.' }); }
        const loaded = preferences.fontId === 'classic' ? await classic : await loadFont(preferences.fontId).then(() => true, () => false);
        const activeFont = loaded ? preferences.fontId : await classic ? 'classic' : undefined;
        update({ preferences, activeFont, hydrated: true, failedFont: loaded ? undefined : preferences.fontId,
          fontError: loaded ? '' : 'The saved font could not load. Using a fallback font; retry when ready.' });
      })();
    },
    selectFront(frontSetId: FrontSetId) {
      if (!state.hydrated) return;
      update({ preferences: { ...state.preferences, frontSetId } }); save();
    },
    selectBack(backId: BackId) {
      if (!state.hydrated) return;
      update({ preferences: { ...state.preferences, backId } }); save();
    },
    selectFont,
    reset() {
      if (!state.hydrated) return;
      ++fontRequest;
      update({ preferences: { ...defaults }, pendingFont: undefined, failedFont: undefined, fontError: '' });
      save();
      void selectFont('classic');
    },
  };
}
