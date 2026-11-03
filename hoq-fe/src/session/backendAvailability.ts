import type { Socket } from './remoteSession';

// Check the actual multiplayer endpoint without creating or joining a table.
// A WebSocket handshake works on web and native without HTTP CORS configuration.
export function checkBackend(endpoint: string, connect: (url: string) => Socket, timeoutMs = 5000) {
  let socket: Socket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  let finish: (available: boolean) => void = () => {};
  const result = new Promise<boolean>(resolve => {
    finish = available => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (socket) {
        socket.onopen = socket.onclose = socket.onerror = null;
        try { socket.close(); } catch { /* Already closed. */ }
      }
      resolve(available);
    };
    try {
      socket = connect(endpoint);
      socket.onopen = () => finish(true);
      socket.onclose = socket.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), timeoutMs);
    } catch { finish(false); }
  });
  return { result, cancel: () => finish(false) };
}
