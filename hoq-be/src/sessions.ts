import { randomInt, randomUUID } from 'node:crypto';
import { applyCommand, createGame, nextRound } from '../../hoq-fe/src/game/engine';
import { shuffle } from '../../hoq-fe/src/game/standardRules';
import { funRules, decisionActor, fallbackCommand, validCommand } from '../../hoq-fe/src/game/specials/framework';
import { projectGame, projectEvents, botCommand } from '../../hoq-fe/src/game/specials/view';
import { copyMatchConfig } from '../../hoq-fe/src/game/specials/selection';
import type { Command, Config, GameEvent, GameState, GameCard } from '../../hoq-fe/src/game/types';
import { fail, type Request } from './protocol';

export interface Peer { send(message: unknown): void; close(): void }
export interface Member { playerId: string; seatId: string; name: string; bot?: boolean; peer?: Peer; disconnectedAt?: number; departed: boolean; requests: Map<string, string> }
export interface Session {
  id: string; joinCode: string; host?: string; config: Config; members: Map<string, Member>;
  game: GameState<GameCard> | null; revision: number; deadline: number | null;
  timers: ReturnType<typeof setTimeout>[]; generation: number; emptySince?: number;
}
export interface Options { maxPlayers: number; reconnectMs: number; idleMs: number; botMs: number; code: () => string; now: () => number }
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class Sessions {
  readonly sessionsById = new Map<string, Session>();
  readonly sessionIdByJoinCode = new Map<string, string>();
  readonly activeJoinCodes = new Set<string>();
  private bindings = new Map<Peer, { session: Session; member: Member }>();
  readonly options: Options;
  constructor(options: Partial<Options> = {}) {
    this.options = { maxPlayers: 8, reconnectMs: 120000, idleMs: 86400000, botMs: 1, now: Date.now,
      code: () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''), ...options };
    if (!Number.isSafeInteger(this.options.maxPlayers) || this.options.maxPlayers < 2 || this.options.maxPlayers > 8) throw new Error('maxPlayers must be between 2 and 8.');
    for (const key of ['reconnectMs', 'idleMs', 'botMs'] as const) {
      if (!Number.isSafeInteger(this.options[key]) || this.options[key] < 1 || this.options[key] > 2147483647) throw new Error(`${key} must be a positive timer duration.`);
    }
  }
  handle(peer: Peer, request: Request) {
    let binding = this.bindings.get(peer);
    if (request.type === 'session.create' || request.type === 'session.join' || request.type === 'session.resume') {
      if (binding) {
        if (binding.member.requests.get(request.requestId) === JSON.stringify(request)) { this.joined(peer, binding.session, binding.member, request.requestId); return; }
        fail('ALREADY_JOINED', 'Leave the current session before joining another.');
      }
      const p = request.payload;
      let session: Session;
      if (request.type === 'session.create') {
        let code = this.options.code();
        let attempts = 0;
        while (this.activeJoinCodes.has(code)) { if (++attempts > 1000) fail('CODE_UNAVAILABLE', 'Could not allocate a join code.'); code = this.options.code(); }
        session = { id: randomUUID(), joinCode: code, config: copyMatchConfig(request.payload.config), members: new Map(), game: null, revision: 0, deadline: null, timers: [], generation: 0 };
        this.activeJoinCodes.add(code); this.sessionsById.set(session.id, session); this.sessionIdByJoinCode.set(code, session.id);
      } else {
        const id = request.type === 'session.join' ? this.sessionIdByJoinCode.get(request.payload.joinCode) : request.payload.sessionId;
        session = this.sessionsById.get(id ?? '') ?? fail('SESSION_EXPIRED', 'Session not found or expired.');
      }
      this.prune(session);
      let member = session.members.get(p.playerId);
      if (member?.bot) fail('MEMBER_NOT_FOUND', 'Bots cannot be claimed by a client.');
      if (member?.departed) fail('MEMBERSHIP_ENDED', 'Your membership in this table has ended.');
      if (!member) {
        if (request.type === 'session.resume') fail('MEMBER_NOT_FOUND', 'Membership expired; join using the code.');
        if (session.game && session.game.phase !== 'game-over') fail('GAME_ACTIVE', 'This game has started. Join after it ends.');
        if ([...session.members.values()].filter(m => !m.departed).length >= this.options.maxPlayers) fail('SESSION_FULL', 'The session is full.');
        member = { playerId: p.playerId, seatId: randomUUID(), name: request.payload.name, departed: false, requests: new Map() };
        session.members.set(member.playerId, member);
      }
      const old = member.peer;
      if (old) { this.bindings.delete(old); old.close(); }
      member.peer = peer; member.disconnectedAt = undefined; session.emptySince = undefined;
      this.bindings.set(peer, { session, member });
      if (!session.host) session.host = member.playerId;
      this.controller(session, member, 'human');
      this.remember(member, request);
      this.schedule(session, false);
      session.revision++;
      this.joined(peer, session, member, request.requestId); this.broadcast(session); return;
    }
    if (!binding) fail('NOT_JOINED', 'Join a session first.');
    const { session, member } = binding;
    const previous = member.requests.get(request.requestId);
    if (previous) {
      if (previous !== JSON.stringify(request)) fail('REQUEST_ID_REUSED', 'Use a new request ID for each operation.');
      peer.send({ type: 'request.ok', requestId: request.requestId, revision: session.revision });
      peer.send(this.snapshot(session, [], member.seatId)); return;
    }
    switch (request.type) {
      case 'session.addBot': {
        if (session.host !== member.playerId) fail('NOT_HOST', 'Only the host can add bots.');
        if (session.game && session.game.phase !== 'game-over') fail('GAME_ACTIVE', 'Bots can only be added before a game.');
        const members = [...session.members.values()].filter(m => !m.departed);
        if (members.length >= this.options.maxPlayers) fail('SESSION_FULL', 'The session is full.');
        let number = 1;
        while (members.some(m => m.name === `Bot ${number}`)) number++;
        const bot: Member = { playerId: randomUUID(), seatId: randomUUID(), name: `Bot ${number}`, bot: true, departed: false, requests: new Map() };
        session.members.set(bot.playerId, bot);
        this.changed(session); break;
      }
      case 'game.end':
        if (session.host !== member.playerId) fail('NOT_HOST', 'Only the host can end the game.');
        session.game = null;
        this.prune(session); this.schedule(session, false);
        this.changed(session, [{ type: 'round-start', message: 'The host ended the game. Choose rules for the next game.' }]);
        break;
      case 'session.kick': {
        if (session.host !== member.playerId) fail('NOT_HOST', 'Only the host can remove players.');
        const target = [...session.members.values()].find(m => m.seatId === request.payload.seatId && !m.departed);
        if (!target || target === member) fail('INVALID_MEMBER', 'Choose another player to remove.');
        if (target.bot) {
          if (session.game && session.game.phase !== 'game-over') fail('GAME_ACTIVE', 'Bots can only be removed before a game.');
          session.members.delete(target.playerId); this.changed(session); break;
        }
        const targetPeer = target.peer;
        if (targetPeer) {
          targetPeer.send({ type: 'request.error', code: 'MEMBERSHIP_ENDED', message: 'The host removed you from the table.' });
          this.disconnect(targetPeer, true);
          targetPeer.close();
        } else {
          target.departed = true; this.controller(session, target, 'bot');
          this.schedule(session, false); this.changed(session);
        }
        break;
      }
      case 'session.configure':
        if (session.host !== member.playerId) fail('NOT_HOST', 'Only the host can set the rules.');
        if (session.game && session.game.phase !== 'game-over') fail('GAME_ACTIVE', 'Rules can only change before a game.');
        session.config = copyMatchConfig(request.payload.config);
        this.changed(session); break;
      case 'session.sync': peer.send(this.snapshot(session, [], member.seatId)); break;
      case 'round.start': {
        if (session.host !== member.playerId) fail('NOT_HOST', 'Only the host can start a round.');
        if (session.game?.phase === 'playing') fail('ROUND_ACTIVE', 'A round is already in progress.');
        this.prune(session);
        const seats = [...session.members.values()].filter(m => !m.departed).map(m => ({ id: m.seatId, name: m.name, controller: m.bot ? 'bot' as const : 'human' as const }));
        if (seats.length < 2) fail('NOT_ENOUGH_PLAYERS', 'At least two players are required.');
        const deck = shuffle(funRules.createDeck(session.config));
        if (seats.length > deck.filter(c => c.kind === 'standard').length) fail('DECK_CAPACITY', 'Not enough normal cards for opening hands.');
        if (session.game?.phase === 'round-over') {
          const old = session.game;
          const players = seats.map(seat => ({ ...seat, hand: [], status: 'playing' as const, total: old.players.find(p => p.id === seat.id)?.total ?? 0, roundScore: 0 }));
          session.game = nextRound({ ...old, players }, deck);
        } else session.game = createGame(seats, session.config, deck);
        this.schedule(session, true); this.changed(session, [{ type: 'round-start', message: 'A new round has started.' }]); break;
      }
      case 'player.action': {
        const game = session.game;
        if (!game || game.phase !== 'playing' || game.round !== request.payload.round || game.turnId !== request.payload.turnId) fail('STALE_TURN', 'This turn is no longer active.');
        if (decisionActor(game) !== member.seatId) fail('NOT_YOUR_TURN', 'Only the player making this decision may act.');
        const command: Command = { ...request.payload, playerId: member.seatId };
        if (!validCommand(game, command)) fail('INVALID_ACTION', 'This action or choice is no longer available.');
        this.act(session, command); break;
      }
      case 'session.leave': this.disconnect(peer, true); break;
    }
    this.remember(member, request);
    peer.send({ type: 'request.ok', requestId: request.requestId, revision: session.revision });
  }
  private remember(member: Member, request: Request) {
    member.requests.set(request.requestId, JSON.stringify(request));
    if (member.requests.size > 128) member.requests.delete(member.requests.keys().next().value!);
  }
  private joined(peer: Peer, session: Session, member: Member, requestId: string) {
    peer.send({ type: 'session.joined', requestId, playerId: member.playerId, seatId: member.seatId, sessionId: session.id, joinCode: session.joinCode });
    peer.send(this.snapshot(session, [], member.seatId));
  }
  snapshot(session: Session, events: GameEvent[] = [], viewerId = '') {
    // Engine IDs are public seat IDs, never the private reconnect player IDs.
    const game = session.game ? projectGame(session.game, viewerId) : null;
    return { type: 'session.state', sessionId: session.id, joinCode: session.joinCode, config: session.config, revision: session.revision, maxPlayers: this.options.maxPlayers, supportsBots: true,
      hostSeatId: session.members.get(session.host ?? '')?.seatId ?? null,
      members: [...session.members.values()].filter(m => !m.departed).map(m => ({ seatId: m.seatId, name: m.name, connected: !!m.peer || !!m.bot, bot: !!m.bot,
        waiting: !!game && !game.players.some(p => p.id === m.seatId), departed: m.departed })),
      game, deadline: session.deadline, serverNow: this.options.now(), events: session.game ? projectEvents(events, session.game, viewerId) : events };
  }
  private broadcast(session: Session, events: GameEvent[] = []) { for (const member of session.members.values()) member.peer?.send(this.snapshot(session, events, member.seatId)); }
  private changed(session: Session, events: GameEvent[] = []) { session.revision++; this.broadcast(session, events); }
  private controller(session: Session, member: Member, controller: 'human' | 'bot') {
    if (session.game) session.game = { ...session.game, players: session.game.players.map(p => p.id === member.seatId ? { ...p, controller } : p) };
  }
  disconnect(peer: Peer, departed = false) {
    const binding = this.bindings.get(peer); if (!binding) return;
    this.bindings.delete(peer);
    const { session, member } = binding;
    if (member.peer !== peer) return;
    member.peer = undefined; member.disconnectedAt = this.options.now(); member.departed = departed;
    if (departed) this.controller(session, member, 'bot');
    if (departed && session.host === member.playerId) {
      const candidates = [...session.members.values()].filter(m => !m.departed && !m.bot);
      session.host = candidates.length ? candidates[randomInt(candidates.length)].playerId : undefined;
    }
    if (![...session.members.values()].some(m => m.peer)) session.emptySince ??= this.options.now();
    this.prune(session); this.schedule(session, false); this.changed(session);
  }
  private prune(session: Session) {
    for (const [id, member] of session.members) {
      const active = session.game?.phase === 'playing' && session.game.players.some(p => p.id === member.seatId);
      // Temporary disconnects retain membership for the lifetime of the table.
      // Departed seats remain until the round ends so special-card references stay valid.
      if (!member.peer && !active && member.departed) session.members.delete(id);
    }
  }
  private act(session: Session, command: Command) {
    const game = session.game!;
    const expired = session.deadline !== null && this.options.now() >= session.deadline;
    if (!validCommand(game, command)) return;
    const result = applyCommand(game, expired ? fallbackCommand(game) : command, funRules);
    if (result.state === game) return;
    session.game = result.state;
    this.prune(session); this.schedule(session, true); this.changed(session, result.events);
  }
  private schedule(session: Session, newTurn: boolean) {
    session.timers.forEach(clearTimeout); session.timers = []; const generation = ++session.generation;
    const game = session.game;
    if (!game || game.phase !== 'playing') { session.deadline = null; return; }
    if (newTurn) session.deadline = game.config.turnMs === null ? null : this.options.now() + game.config.turnMs;
    const enqueue = (delay: number, action: () => Command) => {
      const timer = setTimeout(() => { if (session.generation === generation && this.sessionsById.has(session.id)) this.act(session, action()); }, delay);
      timer.unref(); session.timers.push(timer);
    };
    if (session.deadline !== null) enqueue(Math.max(0, session.deadline - this.options.now()), () => fallbackCommand(game));
    const player = game.players.find(p => p.id === decisionActor(game))!;
    if (player.controller === 'bot') enqueue(this.options.botMs, () => botCommand(game, Math.random));
  }
  sweep() {
    for (const session of this.sessionsById.values()) {
      if (session.emptySince !== undefined && this.options.now() - session.emptySince >= this.options.idleMs) this.delete(session);
      else { const before = session.members.size; this.prune(session); if (before !== session.members.size) this.changed(session); }
    }
  }
  private delete(session: Session) {
    session.generation++; session.timers.forEach(clearTimeout);
    for (const member of session.members.values()) if (member.peer) { this.bindings.delete(member.peer); member.peer.close(); }
    this.sessionsById.delete(session.id); this.sessionIdByJoinCode.delete(session.joinCode); this.activeJoinCodes.delete(session.joinCode);
  }
  dispose() { for (const session of this.sessionsById.values()) this.delete(session); }
}
