# Hit or Quit multiplayer backend

An in-memory, authoritative WebSocket server using the existing frontend's pure game engine and bot policy. No database is required. Run from `hoq-be` with Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
npm start
```

The server listens on port 8080 by default. `GET /health` returns `{"status":"ok"}` and WebSocket clients connect to `ws://localhost:8080/ws`. `npm run dev` builds and starts once; it is not a file watcher.

Environment variables are listed in `.env.example`. Set them in the process environment, or load a copied `.env` explicitly with `node --env-file=.env dist/hoq-be/src/server.js`. Defaults are eight members, two minutes of reconnect retention, five minutes with no connected humans before session deletion, and 30-second heartbeats. The cleanup sweep runs every second. `MAX_PLAYERS` is a server setting, never client controlled.

## Protocol

Send text JSON containing `type`, a unique `requestId` (1–80 letters, digits, underscores, or hyphens), and an object `payload`. Maximum message size is 8 KiB. Generate and retain a cryptographically random UUID v4 as the private `playerId`; retain the returned `sessionId` to reconnect. Reusing that player ID reclaims the member without a separate account. Treat it as a bearer credential.

```json
{"type":"session.create","requestId":"create-1","payload":{"playerId":"6d68dc23-0448-4dd3-bc2a-f897f58d60ac","name":"Alex","config":{"target":30,"turnMs":10000}}}
```

Creation returns `session.joined` with the request ID, private player ID, public seat ID, session ID, and six-character join code. It also sends a `session.state` snapshot. Settings default to target 30 and 10-second turns if `config` is omitted. Supported turn durations are 10000, 30000, or null for unlimited.

| Type | Payload | Behavior |
| --- | --- | --- |
| `session.join` | `playerId`, `name`, `joinCode` | Join a lobby or wait for the next round; codes are case insensitive. |
| `session.resume` | `playerId`, `sessionId` | Reclaim an existing seat, even when full; replaces an older connection. |
| `session.configure` | `config` (`target`, `turnMs`) | Host changes rules in the lobby or after game-over. |
| `round.start` | `{}` | Host starts the first/next round, or a fresh game after game-over. Requires two members. |
| `player.action` | `action`, `round`, `turnId` | Active member requests `hit` or `quit`. The socket supplies the acting identity. |
| `session.sync` | `{}` | Request the latest snapshot. |
| `session.leave` | `{}` | Give up membership; a bot completes an ongoing round. |

An accepted bound request returns `request.ok` with its request ID and current revision. Invalid requests return `request.error` with the request ID when available, an error code, and message. Invalid actions never mutate the game. A valid action received after its deadline becomes a Hit, matching offline behavior.

Each state change broadcasts `session.state` to members of that session only. Snapshots contain `sessionId`, `revision`, `maxPlayers`, `hostSeatId`, public `members`, `game` (null in the lobby), `deadline` (epoch milliseconds or null), and transition `events`. `game` follows the shared `GameState` shape, but every player reference is a public seat ID and `deck` is a sorted inventory, not future draw order. Private player IDs never appear in broadcasts. Clients should replace their state with the newest snapshot, and use `seatId` from `session.joined` to identify their own player. Snapshots can repeat a revision after sync or a request retry.

The last 128 accepted request IDs are retained per member. Retry the same request with the same ID and payload to avoid applying it twice. Use a fresh ID for each new operation. For initial create/join responses lost with the connection, join by code or resume by session ID when available; creation is not globally idempotent across disconnected sockets.

## Session lifecycle

The host is the creator. Host control transfers to the random connected member on disconnect. If everyone disconnects, the next member to return becomes host. There is no automatic round start.

New members arriving during play wait until the host starts the next round. They receive snapshots, count toward capacity, and start with zero cumulative score. Round participants are fixed until the round ends. Waiting players at game-over enter the next game.

A disconnected participant keeps their seat, cards, scores, and status under bot control. Returning with the same private player ID restores human control without undoing completed bot moves or resetting the deadline. Expired reservations are removed outside an active round; active participants remain through the boundary. Departed participants cannot reclaim their ongoing seat. Replacement bots do not add members. Explicitly left or expired members can join again as new members once their prior seat is removed.

All-human disconnect time is tracked independently of bot activity. After the idle timeout, the server removes the session and releases its code. Restarting or stopping the server loses all sessions. Sessions are independent but live in one process.

## Rules and deployment

The backend imports pure engine/types/rules/bot modules from `../hoq-fe/src/game`; compilation includes those modules under `dist/hoq-fe`. Keep the sibling source checkout when building, or deploy the complete generated `dist` tree with backend production dependencies. No Expo runtime is required by the server. Deck exhaustion follows the existing engine: a Hit against an empty deck banks the hand. The standard deck supports at most 52 initial participants; attempts above the selected rules' deck capacity fail clearly even if the configured membership limit is higher.

For EC2, run one process under a service manager. Terminate TLS at the reverse proxy and forward `/ws` with HTTP/1.1 `Upgrade` and `Connection` headers; use a proxy idle timeout longer than the heartbeat interval. Forward `/health` for health checks. Clients use `wss://<backend-host>/ws`. Keep the backend port private when a proxy fronts it. SIGTERM/SIGINT closes sockets and clears session timers. Slow clients with more than 1 MiB queued data are disconnected and can resync.

The frontend now supports Solo/Host/Join via its session adapters. It persists identity in web sessionStorage or native AsyncStorage, renders lobby/waiting states, and handles reconnect/resync. See `../hoq-fe/README.md` for client setup. EC2 deployment remains a separate step.
