# Multiplayer backend plan

## Purpose and scope

Implemented a small WebSocket backend in `hoq-be` that owns multiplayer session state in memory. It receives player actions, validates them, applies the game rules, and broadcasts the updated session to its connected players. Keep the transport, session management, and game rules separate without adding unnecessary infrastructure.

The implementation uses one Node.js/TypeScript process and the `ws` library. There is no database or persistence in this version: restarting the server ends existing sessions. Multiple sessions can run independently in the same process. Running multiple backend processes would later require session routing or shared storage; it is outside this initial implementation.

## In-memory state

- `sessionsById`: a map of session IDs to session state.
- `sessionIdByJoinCode`: a map used to resolve join codes.
- `activeJoinCodes`: a set used to prevent duplicate active codes.
- Connection bindings: associate each accepted socket with its session ID and player ID.

Each session holds its ID, join code, host player ID, configurable player limit, members, waiting players, current round/game state, timers, and an increasing state revision. Store members by player ID and use ordered collections for turn order; do not use eight fixed seats or player-specific fields.

Each member holds a player ID, display name, connection status, and whether they are participating or waiting. Round participants also track whether a human or replacement bot currently controls their seat. Scores and hands belong to the player ID, so changing the controller does not create a new player.

## Identity and session creation

1. The frontend generates and retains a random, unguessable player ID for initial entry and reconnects. The backend generates a unique session ID when creating a session.
2. The creator becomes the host and first member. Return their player ID, session ID, join code, and initial snapshot.
3. Generate a six-character uppercase alphanumeric join code using a cryptographically secure random generator. An alphabet that excludes ambiguous characters is acceptable.
4. Check the candidate against `activeJoinCodes`. Retry on collision, then reserve it and insert the session and lookup entries together before accepting another creation operation.
5. Normalize submitted codes by trimming whitespace and converting to uppercase; reject malformed or unknown codes.
6. Release the code only when the session is deleted.

The session ID identifies the session; the player ID identifies the member within it. For this simple version, possession of an existing player ID allows reclaiming that member, so IDs must be unguessable and other players' reclaimable IDs must not be exposed in public snapshots. Use separate public seat references in broadcasts. Account authentication can be added later if needed.

## Joining and capacity

- New players join using a code and player ID. Return the session ID and current snapshot on success.
- Enforce a configurable `maxPlayers`, initially `8`, through one shared capacity check. Use collection lengths and iteration throughout; changing the limit must not require rewriting session or turn logic.
- Count participating members, waiting members, and disconnected members with reserved seats toward capacity. A replacement bot occupies the disconnected player's existing seat and adds no member.
- Check for an existing member before checking capacity. Reconnecting players can reclaim their seat even when the session is full.
- In the lobby or between rounds, new members are eligible for the next round. Once a round starts, freeze its participant list. Subsequent new members wait, receive updates, and cannot submit round actions until the next round begins.
- At round end, make waiting members eligible for the next round. They start with zero cumulative points and no results for rounds they missed. If the game has ended, they wait for a new game instead.
- Implemented control rule: the host starts the game and advances rounds. If the host disconnects, transfer host control to the random connected member.

## Actions and broadcasts

Use a small JSON protocol with a message type, request ID, and payload. Initial messages create, join, or resume a session. Once bound, a socket may act only for its own member in that session.

Client messages:

- `session.create`: player identity, name, and supported game settings.
- `session.join`: join code, player identity, and name.
- `session.resume`: session ID and the same player ID.
- `round.start`: host request to start the first or next round.
- `player.action`: Hit or Quit, with the expected round and turn ID.
- `session.sync`: request a fresh snapshot.
- `session.leave`: explicitly give up membership and reconnect rights.

Server messages:

- `session.joined`: the caller's identity and session details.
- `session.state`: revision, public members, waiting status, game state, turn deadline, and events from the accepted transition.
- `request.error`: request ID, stable error code, and readable explanation.

A message such as “card drawn by player X” is treated as a request to draw. The server verifies that X is the connected member and active participant, then chooses the card from its own deck and computes the result. Clients do not supply authoritative cards, scores, or next-turn state.

Process transitions sequentially per session. Validate message shape, membership, phase, turn, and permissions before mutation. Reject waiting-player actions, stale turns, and invalid commands without changing state. Keep a bounded request-ID cache per member so retries cannot apply an action twice.

After each accepted change, increment the revision and broadcast a complete public snapshot to all connected members, including waiting players. Complete snapshots keep synchronization simple at this scale. Include visible hands, scores, remaining-card information allowed by the existing rules, and turn state, but exclude deck order, reclaimable player IDs, sockets, and internal timers. Translate internal player IDs to public seat references everywhere in the payload. Send a current snapshot after every join or reconnect.

## Disconnects and bots

1. Detect closed connections and stale connections using WebSocket heartbeat checks.
2. Mark the member disconnected. During an ongoing round, switch their existing seat to bot control immediately, retaining their hand, score, status, and turn position.
3. Schedule bot actions through the same validation and transition path used by human actions. An already-finished participant needs no further actions that round.
4. Rejoining with the same player ID reclaims the member and, during an active round, their original seat. This is a reconnect, so the new-player waiting rule does not apply.
5. Cancel pending bot work when human control resumes. Invalidate scheduled callbacks with a generation counter on every turn or controller change so stale callbacks cannot act after a reconnect or turn change. Already-completed bot moves remain valid.
6. Permit one active connection per member. A new connection replaces the old one; a later close event from the old socket must not disconnect the replacement.

Implemented retention rule: reserve disconnected members for a configurable reconnect period. Never remove an active round participant mid-round; a bot finishes that round. At a round boundary, remove expired disconnected members, while retaining any historical results. Members still within their reconnect period can continue under bot control. Explicitly leaving during a round also uses a bot until the boundary, but relinquishes reconnect rights immediately.

When all humans are disconnected, keep the session available for a configurable idle timeout, then delete it and cancel all timers. Session expiration must work even if bot actions continue. Returning to a deleted session produces a clear session-expired error.

## Implementation progress

1. **Completed — backend package.** Added `package.json`, a dependency lockfile, TypeScript configuration, build/start/test scripts, `.env.example`, and generated-output ignores. `src/server.ts` serves `/health` and `/ws`. Environment settings control the port, player limit (default 8), heartbeat, reconnect retention, and idle expiry.
2. **Completed — shared game rules.** The backend imports the existing pure engine, standard rules, and bot policy from `hoq-fe/src/game`. The backend build includes these modules without loading Expo or UI code. Empty-deck Hits bank the hand, matching offline rules. Membership is configurable; round start rejects participant counts beyond the selected deck's initial-deal capacity.
3. **Completed — protocol and state types.** Added validated request types and error codes in `src/protocol.ts`. Snapshots use public seat IDs throughout, keep private reconnect IDs out of broadcasts, and expose sorted remaining-card inventory without future draw order. Added `request.ok` acknowledgements in addition to the originally planned responses.
4. **Completed — session registry.** `src/sessions.ts` maintains session/code maps, an active-code set, socket bindings, members, host ownership, waiting members, and revision counters. Codes use secure random characters and retry on collision. Capacity counts reservations and waiting members; reconnects bypass new-member capacity checks.
5. **Completed — rounds and actions.** Round starts freeze participants. The server validates active turns, draws cards, updates scores, finishes rounds, admits waiting members into subsequent rounds, and allows the host to start a fresh game after game-over. New members begin with zero cumulative points.
6. **Completed — WebSocket handling.** Added text-JSON validation, an 8 KiB message limit, per-session snapshots, actor identity from socket bindings, and a bounded cache of 128 accepted request IDs per member. Sequential synchronous transitions avoid interleaved session mutations. Slow clients are disconnected rather than accumulating an unlimited send queue.
7. **Completed — scheduling and reconnects.** Added server turn deadlines, bot substitution, one active socket per member, stale-callback cancellation, host transfer, heartbeats, reservation expiry, explicit departure, and idle-session cleanup. Reconnecting retains the existing turn deadline. Session expiry depends on human absence rather than bot activity.
8. **Completed — frontend integration.** Added Solo (default), Host, and Join menu modes; a WebSocket `GameSession` adapter; host lobby settings/start controls; public-seat-based table rendering; waiting-room updates; automatic reconnect/resync; and saved-session recovery. Private player/session IDs use browser sessionStorage or iOS/Android AsyncStorage. Solo still uses its unchanged local session and shares the same engine/rules/bots with the server. Host departure randomly transfers authority to a connected player. Server-side `session.configure` restricts rule changes to the host before a game.
9. **Completed — verification.** `npm test` builds successfully and passes 11 tests, including frontend-adapter integration and solo/multiplayer state parity. Coverage includes real WebSocket clients completing a round and reconnecting; code collisions and release; session isolation; capacity at 2 and 12 members; late joins; duplicate/stale/invalid actions; bot takeover and cancellation on reconnect; old-socket close races; reservation cleanup; idle expiry; host permissions/transfer; late-action deadline handling; and new-game reset.
10. **Completed locally — runtime preparation.** Added local startup, environment, protocol, deployment-artifact layout, EC2 reverse-proxy/TLS guidance, and restart limitations to `README.md`. SIGTERM/SIGINT closes connections and clears timers. Production EC2 deployment and proxy configuration have not been performed.

## Current result

The backend can create and join independent sessions using unique six-character codes, synchronize rounds, queue late joiners, and restore disconnected players while bots keep ongoing rounds moving. It enforces a configurable player limit and holds all multiplayer state in memory. Run `npm ci`, `npm test`, and `npm start` inside `hoq-be` to install, verify/build, and start the server. Frontend integration is complete; production deployment remains separate. Frontend validation also passes 18 tests, typechecking, and web/iOS/Android bundle exports. Browser checks verified multiplayer play, reload/rejoin, host transfer, and Solo bot play. Native physical-device runtime checks remain before release.
