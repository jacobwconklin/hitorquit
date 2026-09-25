import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { parseRequest, RequestError } from './protocol';
import { Sessions, type Options, type Peer } from './sessions';

export function createBackend(options: Partial<Options> & { heartbeatMs?: number } = {}) {
  const sessions = new Sessions(options);
  const server = createServer((req, res) => {
    res.writeHead(req.url === '/health' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.url === '/health' ? { status: 'ok' } : { error: 'Not found' }));
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8192 });
  const alive = new Map<WebSocket, boolean>();
  wss.on('connection', socket => {
    alive.set(socket, true);
    const peer: Peer = {
      send(message) {
        if (socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount > 1024 * 1024) { socket.terminate(); return; }
        socket.send(JSON.stringify(message));
      },
      close() { socket.close(1000, 'Connection replaced or session closed'); }
    };
    socket.on('pong', () => alive.set(socket, true));
    socket.on('message', (data, binary) => {
      let requestId: string | undefined;
      try {
        if (binary) throw new RequestError('INVALID_MESSAGE', 'Send JSON text messages.');
        const raw: unknown = JSON.parse(data.toString());
        if (raw && typeof raw === 'object' && 'requestId' in raw && typeof raw.requestId === 'string' && raw.requestId.length <= 80) requestId = raw.requestId;
        sessions.handle(peer, parseRequest(raw));
      } catch (error) {
        const known = error instanceof RequestError;
        if (!known && !(error instanceof SyntaxError)) console.error('WebSocket request failed:', error);
        peer.send({ type: 'request.error', requestId, code: known ? error.code : error instanceof SyntaxError ? 'INVALID_MESSAGE' : 'INTERNAL_ERROR', message: known ? error.message : error instanceof SyntaxError ? 'Invalid JSON.' : 'The request could not be processed.' });
      }
    });
    socket.on('close', () => { alive.delete(socket); sessions.disconnect(peer); });
    socket.on('error', () => { socket.terminate(); });
  });
  const heartbeat = setInterval(() => {
    for (const [socket, healthy] of alive) {
      if (!healthy) { socket.terminate(); continue; }
      alive.set(socket, false); socket.ping();
    }
  }, options.heartbeatMs ?? 30000);
  const cleanup = setInterval(() => sessions.sweep(), 1000);
  heartbeat.unref(); cleanup.unref();
  return { server, sessions, async close() {
    clearInterval(heartbeat); clearInterval(cleanup); sessions.dispose();
    for (const socket of wss.clients) socket.terminate();
    await new Promise<void>(resolve => wss.close(() => resolve()));
    await new Promise<void>(resolve => server.close(() => resolve()));
  } };
}

function positiveEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) throw new Error(`${name} must be a positive integer below 2147483648.`);
  return value;
}
if (require.main === module) {
  const port = positiveEnv('PORT', 8080);
  if (port > 65535) throw new Error('PORT must be at most 65535.');
  const backend = createBackend({ maxPlayers: positiveEnv('MAX_PLAYERS', 8), reconnectMs: positiveEnv('RECONNECT_MS', 120000), idleMs: positiveEnv('IDLE_MS', 300000), heartbeatMs: positiveEnv('HEARTBEAT_MS', 30000) });
  backend.server.listen(port, process.env.HOST ?? '0.0.0.0', () => console.log(`Hit or Quit backend listening on port ${port}`));
  const shutdown = () => { void backend.close(); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
