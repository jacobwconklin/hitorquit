import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBackend } from '../src/session/backendAvailability';
import type { Socket } from '../src/session/remoteSession';

function fakeSocket() {
  let closed = false;
  const socket: Socket = { readyState: 0, onopen: null, onclose: null, onerror: null, onmessage: null,
    send() { assert.fail('Availability checks must not send session commands'); },
    close() { closed = true; },
  };
  return { socket, closed: () => closed };
}
test('successful handshake enables multiplayer and closes the probe', async () => {
  const fake = fakeSocket();
  const probe = checkBackend('wss://example.test/ws', url => {
    assert.equal(url, 'wss://example.test/ws'); return fake.socket;
  });
  fake.socket.onopen!();
  assert.equal(await probe.result, true);
  assert.equal(fake.closed(), true);
});
test('error, close, timeout, cancellation and construction failure resolve offline', async () => {
  for (const action of ['error', 'close', 'timeout', 'cancel']) {
    const fake = fakeSocket();
    const probe = checkBackend('wss://example.test/ws', () => fake.socket, 5);
    if (action === 'error') fake.socket.onerror!();
    if (action === 'close') fake.socket.onclose!({ code: 1006 });
    if (action === 'cancel') probe.cancel();
    assert.equal(await probe.result, false, action);
    assert.equal(fake.closed(), true);
    assert.equal(fake.socket.onopen, null);
  }
  assert.equal(await checkBackend('invalid', () => { throw new Error('Unavailable'); }).result, false);
});
