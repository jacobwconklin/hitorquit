import { validatePreferences, type AppearancePreferences } from './catalog';
export interface AppearanceStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export const appearanceKey = 'hoq.appearance.v1';
export function createPreferenceStore(storage: AppearanceStorage) {
  let pending = Promise.resolve();
  return {
    async load() {
      await pending.catch(() => {});
      const raw = await storage.getItem(appearanceKey);
      try { return validatePreferences(raw ? JSON.parse(raw) : null); }
      catch { return validatePreferences(null); }
    },
    save(preferences: AppearancePreferences) {
      const value = JSON.stringify(validatePreferences(preferences));
      const write = pending.catch(() => {}).then(() => storage.setItem(appearanceKey, value));
      pending = write;
      return write;
    },
  };
}
