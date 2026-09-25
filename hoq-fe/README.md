# Hit or Quit

A React Native / Expo card game with offline Solo and online Host/Join modes. Solo uses one human and 2–7 local bots (default 2) and requires no backend. The supplied Classic font and card art are bundled.

## Run

Use Node.js 22.13 or newer:

```sh
pnpm install
npm run web
```

Open the URL printed by Expo. For native development, run `npm start` and connect a compatible Expo Go/development build, or use `npm run android` / `npm run ios` with the appropriate emulator. An iOS simulator requires macOS. This project uses Expo SDK 55; the native client must support that SDK.

```sh
npm test           # deterministic rules, simulated matches, session/timer tests
npm run typecheck
npm run build:web  # static web bundle in dist/
```

The installed native app can play offline. The web app runs without a backend after loading; a service worker for cold offline browser launches is not included. Solo matches are in memory and reset on refresh or exit. Multiplayer seats can be reclaimed from the menu after refresh or app restart while the backend session is alive.

## Play

Choose a target (default 30), 2–7 bots, and a turn time of 10 seconds (default), 30 seconds, or unlimited, then deal in. Unlimited turns have no deadline or automatic Hit; bots still act normally. Hit draws a card; a duplicate rank busts your hand for zero points. Quit banks one point per card, plus 3 for a flush, 3 for a straight, and 5 for seven cards. Seven safe cards auto-bank. An expired timer always hits. If a large table exhausts the deck, a Hit banks the player's current hand instead.

Each round uses a fresh deck. All players finish the round before checking the target; the highest total wins and tied highest totals share victory. The starting player rotates. Click a bot to inspect its hand. Scores/deck opens round history and the remaining card inventory; the timer continues during inspection.

Mobile and narrow windows (below 1024 logical pixels) use a vertical page: opponents stacked at the top, scoreboard button and deck, Quit/Hit controls, then the hand. New matches scroll to the bottom once. Cards wrap into readable rows and subsequent turns preserve your scroll position. Portrait and landscape are supported. Wider desktop windows retain the table layout and scroll vertically if needed. The native orientation setting is now unrestricted; existing installed native builds need rebuilding to pick up that configuration change.

## Code map and extension points

- `src/game/types.ts`: serializable card, state, command, and rule contracts. The engine is generic over the card type.
- `src/game/engine.ts`: pure state transitions, command validation, rounds, and results. No React, clocks, or I/O.
- `src/game/standardRules.ts`: standard deck, scoring, and draw effects. Extend the card union and provide a new `Rules<CardType>` implementation for special cards; extend its outcome contract for effects such as skip/reverse when needed.
- `src/game/bots.ts`: independent bot policy using public hand/deck information, without draw order.
- `src/session/types.ts`: replaceable session/snapshot interface.
- `src/session/localSession.ts`: local authority, injected randomness/scheduler, bot scheduling, deadlines, stale-turn protection, cleanup. Unchanged by multiplayer integration; it continues to own offline games.
- `src/session/remoteSession.ts`: WebSocket adapter implementing the same gameplay interface plus lobby/connection state, rule configuration, persistence callbacks, reconnects, and explicit leave. It never computes authoritative game transitions.
- `src/session/platformStorage.ts`: browser sessionStorage and native AsyncStorage, plus secure UUID generation and backend URL selection.
- `src/ui/`: React Native presentation and reusable card/theme components. Game UI consumes the session interface; standard-card presentation/score previews are intentionally in the standard-game UI and can gain a renderer registry for future card kinds.
- `src/game/setup.ts`: supported turn-time choices and creation of one human plus 2–7 unique bot seats.
- `App.tsx`: composition root; selects Solo/Host/Join, composes the appropriate session adapter, and owns its lifetime.

Original 60 × 90 pixel assets retain their aspect ratio; web uses pixelated image rendering. Native uses the standard image renderer and should be checked on physical devices for sharpness. Native device builds and app-store publication are separate steps.

## Multiplayer

Start the backend from `hoq-be` with `npm ci`, `npm test`, and `npm start`. Select **Host**, enter your name, choose the rules, and create a table. Share the six-character code. Others select **Join** and enter it. Only the host can configure rules in the lobby or start the game/next round. Rules are fixed once a game starts. When the host leaves or disconnects, the server randomly selects another connected member as host; returning does not reclaim host authority.

Late arrivals see a waiting screen with live round information and enter the next round. Disconnected participants are controlled by bots until they reconnect. Other humans are displayed as opponents, and each client sees its own hand by its public seat ID. The shared table sends identical Hit/Quit commands through `GameSession`; Solo uses `createLocalSession`, multiplayer uses `createRemoteSession`. The backend directly imports the same pure engine, rules, and bot policy that Solo uses. Change gameplay in `src/game`, not in the network adapter. A real-server integration test checks solo/multiplayer state parity for the same deck and actions.

The private player ID and backend session ID are stored under `hoq.multiplayer.identity.v1`. Web uses **sessionStorage**, isolated per tab and retained across reloads. iOS/Android use **AsyncStorage**, retained across app restarts. The saved backend URL is retained too. **Rejoin saved table** resumes the same seat; active connections also retry automatically after network loss and sync on app foreground. Explicit Leave clears the saved session ID and retains the player ID. Expired sessions clear the stale session ID. Closing a browser tab normally clears that tab's storage. Solo remains the default and never opens a WebSocket.

Set `EXPO_PUBLIC_WS_URL` before starting Expo or exporting a build when the backend is hosted elsewhere. Copy `.env.example` and use `ws://<computer-LAN-IP>:8080/ws` for physical-device development or `wss://<backend-host>/ws` for production. Local defaults: web uses its current hostname on port 8080; Android emulator uses `10.0.2.2:8080`; iOS simulator uses `localhost:8080`. HTTPS web builds default to `wss://<current-host>/ws`, so a reverse proxy must route `/ws` to the backend. Public Expo environment values are baked into exports. New native dependencies require rebuilding an existing development/standalone app.

Validation: frontend rule/session/storage tests, backend adapter integration tests, TypeScript checks, web/iOS/Android bundle exports, and browser checks of host/join, turns, reload/rejoin, host transfer, and solo bot play. Device runtime checks should still be performed on iOS and Android before release.
