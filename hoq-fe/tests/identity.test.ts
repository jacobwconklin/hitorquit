import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createIdentityStore } from '../src/session/identityStore';

test('identity survives reload, stores session ID, and clears only session on departure', async () => {
  let value: string | null = null;
  const storage = { async getItem() { return value; }, async setItem(_key: string, next: string) { value = next; } };
  const first = createIdentityStore(storage, randomUUID);
  const identity = await first.load();
  await first.save({ ...identity, sessionId: 'session-one', endpoint: 'wss://example.test/ws' });
  const reloaded = createIdentityStore(storage, randomUUID);
  assert.deepEqual(await reloaded.load(), { ...identity, sessionId: 'session-one', endpoint: 'wss://example.test/ws' });
  await reloaded.save(identity); assert.equal((await reloaded.load()).playerId, identity.playerId);
  assert.equal((await reloaded.load()).sessionId, undefined);
  value = '{broken'; assert.notEqual((await reloaded.load()).playerId, identity.playerId);
});
