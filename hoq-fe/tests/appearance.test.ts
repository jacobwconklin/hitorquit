import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, validatePreferences, type AppearancePreferences, type FontId } from '../src/appearance/catalog';
import { appearanceKey, createPreferenceStore } from '../src/appearance/preferenceStore';
import { createAppearanceController } from '../src/appearance/controller';
import { specialGuide } from '../src/game/specials/guide';
import { definitions } from '../src/game/specials/registry';
import { funRules } from '../src/game/specials/framework';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function memory(initial: string | null = null) {
  let value = initial;
  const writes: string[] = [];
  return { writes, get value() { return value; },
    async getItem(key: string) { assert.equal(key, appearanceKey); return value; },
    async setItem(key: string, next: string) { assert.equal(key, appearanceKey); writes.push(next); value = next; },
  };
}
const custom: AppearancePreferences = { version: 1, frontSetId: 'flowers', backId: 'web', fontId: 'sofia' };

test('invalid records fall back, while a removed option preserves the other valid choices', async () => {
  for (const raw of [null, '{broken', 'null', '[]', '3', '{}', JSON.stringify({ ...custom, version: 2 })]) {
    assert.deepEqual(await createPreferenceStore(memory(raw)).load(), defaults);
  }
  assert.deepEqual(validatePreferences({ ...custom, frontSetId: '../../bad' }), { ...custom, frontSetId: 'default' });
  assert.deepEqual(validatePreferences({ ...custom, backId: 'removed' }), { ...custom, backId: 'triangle' });
  assert.deepEqual(validatePreferences({ ...custom, fontId: null }), { ...custom, fontId: 'classic' });
});

test('preferences survive a fresh controller and reset persists all defaults', async () => {
  const storage = memory(JSON.stringify(custom));
  const controller = createAppearanceController(createPreferenceStore(storage), async () => {});
  await controller.initialize();
  assert.deepEqual(controller.getSnapshot().preferences, custom);
  assert.equal(controller.getSnapshot().activeFont, 'sofia');
  assert.equal(storage.writes.length, 0, 'hydration must not write defaults');
  controller.reset(); await flush();
  const reloaded = createAppearanceController(createPreferenceStore(storage), async () => {});
  await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().preferences, defaults);
});

test('hydration is idempotent and cannot overwrite saved data with early selections', async () => {
  const read = deferred<string | null>();
  let reads = 0, writes = 0;
  const controller = createAppearanceController(createPreferenceStore({
    getItem: () => { reads++; return read.promise; }, setItem: async () => { writes++; },
  }), async () => {});
  const first = controller.initialize();
  assert.equal(controller.initialize(), first);
  controller.selectFront('swords'); controller.selectBack('blocks'); controller.reset(); await controller.selectFont('rye');
  read.resolve(JSON.stringify(custom)); await first;
  assert.equal(reads, 1); assert.equal(writes, 0);
  assert.deepEqual(controller.getSnapshot().preferences, custom);
});

test('writes are serialized and a rejected save does not poison subsequent saves', async () => {
  const first = deferred<void>(); const writes: string[] = [];
  const store = createPreferenceStore({ getItem: async () => null, setItem: async (_key, value) => {
    writes.push(value); if (writes.length === 1) await first.promise;
  } });
  const a = store.save(custom); const rejected = assert.rejects(a, /unavailable/);
  const b = store.save(defaults);
  await flush(); assert.equal(writes.length, 1);
  first.reject(new Error('unavailable')); await rejected; await b;
  assert.deepEqual(JSON.parse(writes[1]), defaults);
});

test('the latest font wins even when an earlier request finishes last; other selections remain', async () => {
  const requests = { rye: deferred<void>(), sofia: deferred<void>() };
  const storage = memory();
  const controller = createAppearanceController(createPreferenceStore(storage), id => id === 'classic' ? Promise.resolve() : requests[id as keyof typeof requests].promise);
  await controller.initialize();
  const old = controller.selectFont('rye'); const latest = controller.selectFont('sofia');
  controller.selectFront('tetra'); controller.selectBack('celestial');
  assert.equal(controller.getSnapshot().activeFont, 'classic');
  requests.sofia.resolve(); await latest;
  requests.rye.resolve(); await old; await flush();
  assert.deepEqual(controller.getSnapshot().preferences, { version: 1, frontSetId: 'tetra', backId: 'celestial', fontId: 'sofia' });
  assert.equal(controller.getSnapshot().activeFont, 'sofia');
  assert.equal(JSON.parse(storage.value!).fontId, 'sofia');
});

test('reset invalidates a pending font request', async () => {
  const request = deferred<void>(); const storage = memory();
  const controller = createAppearanceController(createPreferenceStore(storage), id => id === 'rye' ? request.promise : Promise.resolve());
  await controller.initialize();
  controller.selectFront('elements'); const pending = controller.selectFont('rye');
  controller.reset(); request.resolve(); await pending; await flush();
  assert.deepEqual(controller.getSnapshot().preferences, defaults);
  assert.deepEqual(JSON.parse(storage.value!), defaults);
  assert.equal(controller.getSnapshot().activeFont, 'classic');
});

test('font failure retains the working font and selection; retry can succeed', async () => {
  let fail = true;
  const controller = createAppearanceController(createPreferenceStore(memory()), async id => {
    if (id === 'rye' && fail) throw new Error('font unavailable');
  });
  await controller.initialize(); await controller.selectFont('rye');
  assert.equal(controller.getSnapshot().activeFont, 'classic');
  assert.equal(controller.getSnapshot().preferences.fontId, 'classic');
  assert.equal(controller.getSnapshot().failedFont, 'rye');
  fail = false; await controller.selectFont('rye');
  assert.equal(controller.getSnapshot().activeFont, 'rye');
  assert.equal(controller.getSnapshot().fontError, '');
});

test('saved-font failure falls back to Classic, or to the system when both fail', async () => {
  for (const classicWorks of [true, false]) {
    const controller = createAppearanceController(createPreferenceStore(memory(JSON.stringify(custom))), async (id: FontId) => {
      if (id !== 'classic' || !classicWorks) throw new Error('offline font');
    });
    await controller.initialize();
    assert.equal(controller.getSnapshot().hydrated, true);
    assert.equal(controller.getSnapshot().activeFont, classicWorks ? 'classic' : undefined);
    assert.equal(controller.getSnapshot().failedFont, 'sofia');
  }
});

test('storage failures retain in-memory choices and a later save clears the notice', async () => {
  let fail = true;
  const controller = createAppearanceController(createPreferenceStore({
    getItem: async () => { throw new Error('blocked'); },
    setItem: async () => { if (fail) throw new Error('blocked'); },
  }), async () => {});
  await controller.initialize(); assert.equal(controller.getSnapshot().hydrated, true);
  assert.match(controller.getSnapshot().storageError, /restored/);
  controller.selectFront('flowers'); await flush();
  assert.equal(controller.getSnapshot().preferences.frontSetId, 'flowers');
  assert.match(controller.getSnapshot().storageError, /saved/);
  fail = false; controller.selectBack('web'); await flush();
  assert.equal(controller.getSnapshot().storageError, '');
});

test('guide covers every nonstandard deck card plus the WAR reward, with live action descriptions', () => {
  const signature = (card: typeof specialGuide[number]['card']) => card.kind === 'special' ? card.special : 'suit' in card ? `${card.kind}-${card.suit}` : card.kind;
  const guideTypes = specialGuide.map(entry => signature(entry.card));
  assert.equal(new Set(guideTypes).size, guideTypes.length);
  for (const card of funRules.createDeck().filter(card => card.kind !== 'standard')) assert.ok(guideTypes.includes(signature(card)));
  assert.ok(guideTypes.includes('blank-all'));
  for (const entry of specialGuide) {
    assert.ok(entry.description.length > 20);
    if (entry.card.kind === 'special') assert.equal(entry.description, definitions[entry.card.special].description);
  }
});
