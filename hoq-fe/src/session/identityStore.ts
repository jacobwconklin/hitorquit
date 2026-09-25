export interface Identity { playerId: string; sessionId?: string; endpoint?: string }
export interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
const key = 'hoq.multiplayer.identity.v1';
export function createIdentityStore(storage: Storage, uuid: () => string) {
  let pending = Promise.resolve();
  return {
    async load(): Promise<Identity> {
      await pending;
      const raw = await storage.getItem(key);
      if (raw) {
        try {
          const value = JSON.parse(raw);
          if (typeof value.playerId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.playerId)) {
            return { playerId: value.playerId, sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined, endpoint: typeof value.endpoint === 'string' ? value.endpoint : undefined };
          }
        } catch { /* Replace corrupt data with a new identity. */ }
      }
      const identity = { playerId: uuid() }; await storage.setItem(key, JSON.stringify(identity)); return identity;
    },
    save(identity: Identity) {
      const serialized = JSON.stringify(identity);
      const write = pending.catch(() => {}).then(() => storage.setItem(key, serialized));
      pending = write; return write;
    },
  };
}
