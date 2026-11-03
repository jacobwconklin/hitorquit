# Hit or Quit multiplayer backend

An in-memory, authoritative WebSocket server using the existing frontend's pure game engine and bot policy. No database is required. Run from `hoq-be` with Node.js 22 or newer:

```sh
npm ci
npm test
npm run build
npm start
```

The server listens on port 8080 by default. `GET /health` returns `{"status":"ok"}` and WebSocket clients connect to `ws://localhost:8080/ws`. `npm run dev` builds and starts once; it is not a file watcher.

Environment variables are listed in `.env.example`. Set them in the process environment, or load a copied `.env` explicitly with `node --env-file=.env dist/hoq-be/src/server.js`. Defaults are eight members, 24 hours with no connected humans before session deletion, and 30-second heartbeats. Disconnected membership lasts for the lifetime of the table; RECONNECT_MS is retained for configuration compatibility but no longer expires seats. The cleanup sweep runs every second. `MAX_PLAYERS` is a server setting, never client controlled.

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
| `session.configure` | `config` (`target`, `turnMs`, optional `enabledSpecials`) | Host changes rules in the lobby or after game-over. |
| `round.start` | `{}` | Host starts the first/next round, or a fresh game after game-over. Requires two members. |
| `player.action` | `action`, `round`, `turnId`, plus `choiceId` and `optionId` for `choose` | Submit `hit`/`quit`, or the pending decision actor's `choose`. Socket supplies acting identity. |
| `game.end` | `{}` | Host ends the game for everyone and returns the table to the lobby. |
| `session.kick` | `{ seatId }` | Host removes another connected or disconnected player at any time. |
| `session.sync` | `{}` | Request the latest snapshot. |
| `session.leave` | `{}` | Give up membership; a bot completes an ongoing round. |

An accepted bound request returns `request.ok` with its request ID and current revision. Invalid requests return `request.error` with the request ID when available, an error code, and message. Invalid actions never mutate the game. A valid action received after its deadline becomes a Hit for a normal turn, or the first legal option for a special choice, matching Solo. A pending choice has its own actor (possibly another player), unique choice ID, options, and fresh decision deadline; the original turn advances only after all effects finish.

Both `session.create` and `session.configure` accept `config.enabledSpecials`, an array of unique IDs from `hoq-fe/src/game/specials/selection.ts`: the twelve action IDs, `blank-spades`, `blank-clubs`, `blank-hearts`, `blank-diamonds`, and `rainbow-ace`. Omission uses the default selection, excluding WAR and Musical Chairs; `[]` means no specials. Invalid IDs, duplicate IDs, and non-array values are rejected with `INVALID_CONFIG`. All 52 standard cards are always included. The all-suit blank is generated only by WAR, not an independently selectable deck card.

Normalized selections are included in lobby snapshots and `game.config`, remain fixed for a match, and apply to every new round and second-deck refill. Host transfer, sync, resume, and late joins retain the same settings. Updating lobby settings after game-over does not alter the completed game's configuration. Deploy the updated backend before the frontend so the server enforces card exclusions.

Each state change broadcasts `session.state` to members of that session only. Snapshots contain `sessionId`, `revision`, `maxPlayers`, `hostSeatId`, public `members`, `game` (null in the lobby), `deadline` (epoch milliseconds or null), and transition `events`. `game` follows the shared `GameState` shape, but every player reference is a public seat ID and `deck` is a sorted inventory, not future draw order. Private player IDs never appear in broadcasts. Clients should replace their state with the newest snapshot, and use `seatId` from `session.joined` to identify their own player. Snapshots can repeat a revision after sync or a request retry.

The server uses the same `funRules` as Solo. See [implemented specials](../implemented_specials.md) for the 67-card deck, second-deck refill, and card assumptions. Snapshots are projected separately for each viewer on broadcast, sync, retry, and resume. Internal jobs, secret contest submissions, and trap ranks are omitted; blinded viewers receive hidden-card handles and no meaningful score/inventory values (`informationHidden` tells UI to hide them). Choice options are sent only to their decision actor, with opaque option IDs instead of executable selections. Bots use these same visibility rules. Deploy the backend and frontend for the new card definitions.

The last 128 accepted request IDs are retained per member. Retry the same request with the same ID and payload to avoid applying it twice. Use a fresh ID for each new operation. For initial create/join responses lost with the connection, join by code or resume by session ID when available; creation is not globally idempotent across disconnected sockets.

Snapshots also include `serverNow` (epoch milliseconds at snapshot creation). Updated clients anchor `deadline - serverNow` to their local monotonic clock, avoiding device wall-clock skew. Delivery latency can make the display slightly late; the server still enforces the deadline. Sync/resume refreshes the anchor without extending the turn. This additive field preserves older clients; deploy the backend before the frontend. Older clients retain their existing countdown behavior until updated.

## Session lifecycle

The creator is host and retains authority through temporary disconnects. Explicitly leaving transfers host control to another remaining member. There is no automatic round start.

New players cannot join between the first deal and game-over, including between rounds. Existing members can resume at any point. Completed games show results in the lobby; the host can change rules and replay using the same code and membership. Ending early clears the match and its timers for everyone, also returning to the lobby.

Disconnected participants retain their seats, cards, scores, and pending choices. Normal turn deadlines continue; unlimited turns wait for the player to return (or the host to remove them or end the game). Resuming returns a current server snapshot without extending deadlines. Disconnected players are never pruned while the table exists.

Explicit departure or a host kick releases membership. A bot finishes the departed seat's current round to keep special-card references valid, then the seat is removed. A new membership can join after the match ends.

After 24 hours with everyone disconnected (configurable via IDLE_MS), the server removes the session and releases its code. Restarting or stopping the server also loses all sessions, which currently live in one process's memory.

## Rules and deployment

The backend imports pure engine/types/rules/bot modules from `../hoq-fe/src/game`; compilation includes those modules under `dist/hoq-fe`. Keep the sibling source checkout when building, or deploy the complete generated `dist` tree with backend production dependencies. No Expo runtime is required by the server. Deck exhaustion follows the existing engine: a Hit against an empty deck banks the hand. The standard deck supports at most 52 initial participants; attempts above the selected rules' deck capacity fail clearly even if the configured membership limit is higher.

For EC2, run one process under a service manager. Terminate TLS at the reverse proxy and forward `/ws` with HTTP/1.1 `Upgrade` and `Connection` headers; use a proxy idle timeout longer than the heartbeat interval. Forward `/health` for health checks. Clients use `wss://<backend-host>/ws`. Keep the backend port private when a proxy fronts it. SIGTERM/SIGINT closes sockets and clears session timers. Slow clients with more than 1 MiB queued data are disconnected and can resync.

The frontend now supports Solo/Host/Join via its session adapters. It persists identity in web sessionStorage or native AsyncStorage, renders lobby/waiting states, and handles reconnect/resync. See `../hoq-fe/README.md` for client setup. EC2 deployment remains a separate step.
