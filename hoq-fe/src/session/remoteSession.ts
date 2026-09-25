import type { Config, GameState, GameEvent } from '../game/types';
import type { GameSession, Snapshot } from './types';
import type { Identity } from './identityStore';

export interface Socket {
  readyState: number; send(data: string): void; close(): void;
  onopen: (() => void) | null; onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event: { code: number }) => void) | null; onerror: (() => void) | null;
}
export interface RemoteState {
  game: GameState | null; deadline: number | null; events: GameEvent[];
  revision: number; seatId?: string; hostSeatId?: string; joinCode: string; config: Config;
  members: { seatId: string; name: string; connected: boolean; waiting: boolean; departed: boolean }[];
  maxPlayers: number; connected: boolean; error?: string;
}
export interface RemoteSession extends GameSession {
  getRemoteSnapshot(): RemoteState;
  configure(config: Config): void;
  leave(): Promise<void>;
}
export function createRemoteSession(options: {
  endpoint: string; identity: Identity; name: string;
  mode: 'host' | 'join' | 'resume'; joinCode?: string; config: Config;
  uuid(): string; connect(url: string): Socket;
  save(identity: Identity): Promise<void>; retryMs?: number;
}): RemoteSession {
  let identity = { ...options.identity };
  let state: RemoteState = { game: null, deadline: null, events: [], revision: -1, joinCode: '', config: options.config, members: [], maxPlayers: 8, connected: false };
  let snapshot: Snapshot | undefined;
  let socket: Socket | undefined;
  let disposed = false; let terminal = false; let attempt = 0;
  let joined = options.mode === 'resume';
  let retry: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let leaveDone: (() => void) | undefined;
  let leaveRequest: string | undefined;
  const listeners = new Set<() => void>();
  function update(patch: Partial<RemoteState>) {
    state = { ...state, ...patch };
    if (state.game) snapshot = { game: state.game, deadline: state.deadline, events: state.events, localPlayerId: state.seatId,
      multiplayer: { isHost: state.seatId === state.hostSeatId, connected: state.connected, joinCode: state.joinCode, error: state.error } };
    listeners.forEach(fn => fn());
  }
  function persist(value: Identity) {
    identity = value;
    void options.save(value).catch(() => { if (!disposed) update({ error: 'Could not save your session on this device.' }); });
  }
  function send(type: string, payload: object = {}) {
    if (socket?.readyState !== 1) { update({ error: 'Reconnecting. Please wait before acting.' }); return; }
    const requestId = options.uuid(); socket.send(JSON.stringify({ type, requestId, payload })); return requestId;
  }
  function connect() {
    if (disposed || terminal) return;
    clearTimeout(retry); clearTimeout(watchdog);
    let current: Socket;
    try { current = options.connect(options.endpoint); } catch { reconnect(); return; }
    socket = current;
    watchdog = setTimeout(() => { if (!disposed && socket === current && !state.connected) current.close(); }, 10000);
    current.onopen = () => {
      if (disposed || socket !== current) return;
      if (identity.sessionId && joined) send('session.resume', { playerId: identity.playerId, sessionId: identity.sessionId });
      else if (options.mode === 'host') send('session.create', { playerId: identity.playerId, name: options.name, config: options.config });
      else send('session.join', { playerId: identity.playerId, name: options.name, joinCode: options.joinCode });
    };
    current.onmessage = event => {
      if (disposed || socket !== current) return;
      let message: any; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'session.joined') {
        joined = true;
        clearTimeout(watchdog); attempt = 0;
        persist({ playerId: identity.playerId, sessionId: message.sessionId, endpoint: options.endpoint });
        update({ seatId: message.seatId, joinCode: message.joinCode, connected: true, error: undefined });
      } else if (message.type === 'session.state' && message.revision >= state.revision) {
        update({ game: message.game, deadline: message.deadline, events: message.events, revision: message.revision,
          config: message.config, members: message.members, hostSeatId: message.hostSeatId, maxPlayers: message.maxPlayers, joinCode: message.joinCode });
      } else if (message.type === 'request.error') {
        update({ error: message.message });
        if (['SESSION_EXPIRED', 'MEMBER_NOT_FOUND', 'MEMBERSHIP_ENDED'].includes(message.code)) {
          persist({ playerId: identity.playerId }); terminal = true; current.close(); update({ connected: false });
        } else if (!state.connected) { terminal = true; clearTimeout(watchdog); current.close(); }
      } else if (message.type === 'request.ok') {
        if (message.requestId === leaveRequest) leaveDone?.();
        else update({ error: undefined });
      }
    };
    current.onclose = event => {
      if (disposed || socket !== current) return;
      clearTimeout(watchdog); update({ connected: false });
      if (event.code === 1000 && !terminal) { terminal = true; update({ error: 'This session was opened elsewhere or closed. Return to the menu to reconnect.' }); }
      else reconnect();
    };
    current.onerror = () => { if (!disposed && socket === current) current.close(); };
  }
  function reconnect() {
    if (disposed || terminal) return;
    update({ connected: false, error: 'Connection lost. Reconnecting…' });
    retry = setTimeout(connect, Math.min(10000, (options.retryMs ?? 500) * 2 ** Math.min(attempt++, 5)));
  }
  function dispose() { disposed = true; clearTimeout(retry); clearTimeout(watchdog); socket?.close(); listeners.clear(); }
  const api: RemoteSession = {
    getRemoteSnapshot: () => state,
    getSnapshot: () => { if (!snapshot) throw new Error('No game has started.'); return snapshot; },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    submit(command) { if (state.connected && state.game && command.playerId === state.seatId) send('player.action', { action: command.action, round: state.game.round, turnId: command.turnId }); },
    advanceRound() { if (state.connected && state.hostSeatId === state.seatId) send('round.start'); },
    configure(config) { if (state.connected && state.hostSeatId === state.seatId) send('session.configure', { config }); },
    resume() { if (state.connected) send('session.sync'); else if (!terminal) { socket?.close(); connect(); } },
    async leave() {
      terminal = true;
      if (state.connected) await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 1000);
        leaveDone = () => { clearTimeout(timeout); resolve(); }; leaveRequest = send('session.leave');
      });
      dispose(); await options.save({ playerId: identity.playerId });
    },
    dispose,
  };
  connect(); return api;
}
