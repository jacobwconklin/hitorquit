# Hit or Quit

A React Native / Expo card game with offline Solo and online Host/Join modes. Solo uses one human and 2–7 local bots (default 2) and requires no backend. Five card-front sets, eight card backs, and thirteen fonts are bundled.

## Supported platforms and current release

Hit or Quit is supported as a **website** (desktop and mobile browsers, including iPhone/iPad Safari) and a **native iOS app for iPhone and iPad**. Features must work on both platforms. Android tooling remains available but Android store release is not currently a supported release target.

| Setting | Current value |
| --- | --- |
| Frontend / App Store version | **1.0.0** |
| iOS build number | **1** |
| Bundle identifier | `com.jacobconklin.hitorquit` |
| Native devices | iPhone and iPad (`supportsTablet: true`) |
| Release status | Configured in source; not yet archived, uploaded, or published by this setup |

`app.json` owns the native configuration. Keep `expo.version` and `package.json` version synchronized. Backend package versioning is independent. See [the iOS release checklist](#ios-release-checklist) for every release; website deployment is documented in [the deployment guide](../_DEPLOY.md).

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

The installed native app can play offline. The web app runs without a backend after loading; a service worker for cold offline browser launches is not included. At launch, a five-second WebSocket connection check enables Host/Join and saved-table rejoining only when the backend is reachable. Otherwise the menu shows offline mode with a retry button. Solo is available immediately, including while checking. Saved tables are rejoined explicitly from the menu so a delayed startup connection cannot interrupt solo play. Solo matches are in memory and reset on refresh or exit. Multiplayer seats can be reclaimed from the menu after refresh or app restart while the backend session is alive.

## Play

Choose a target (default 30), 2–7 bots, and a turn time of 10 seconds (default), 30 seconds, or unlimited, then deal in. Unlimited turns have no deadline; bots still act. A duplicate rank busts for zero points. Quit banks one point per scoring card, plus 3 for a flush, 3 for a straight, and 5 for seven cards. Seven cards permits more Hits; thirteen safe cards wins immediately. An expired normal turn hits; an expired special choice selects its first legal option. An empty-deck Hit banks the hand.

Each round deals one normal card to each player from a fresh deck: 52 standard cards plus the selected specials (67 cards by default; 69 with all enabled). Below 13 remaining cards, one complete second deck with the same selections is shuffled in. The target is checked after the round; highest qualifying totals win and ties share victory, unless someone wins immediately with thirteen safe cards. The starting player rotates. Click an opponent to inspect their hand. Scores/deck shows round history and remaining inventory; inspection does not pause timers. Blindfold hides these details. See [implemented specials and assumptions](../implemented_specials.md).

Mobile and narrow windows (below 1024 logical pixels) use a vertical page: Table / Players (multiplayer only), the header, opponents stacked at the top, scoreboard button and deck, special choices, then the hand. The turn indicator, timer and Quit/Hit controls sit in a fixed bottom area below the scrolling table on web and native iOS. This area reserves its own space so it does not cover the hand. Table / Players scrolls away with the page; the session code is available in its popup instead of a permanent top bar. New matches scroll to the bottom once. Cards wrap into readable rows and subsequent turns preserve your scroll position. Portrait and landscape are supported. Wider desktop windows retain the table layout and scroll vertically if needed. The native orientation setting is now unrestricted; existing installed native builds need rebuilding to pick up that configuration change.

## Customize and learn the cards

On the title screen, open **Customize cards & font** to independently choose Default, Elements, Flowers, Swords, or Tetra fronts; one of eight backs; and one of thirteen rank fonts. The live preview shows all four suits, a two-digit rank, and a back. The preview, **Done**, and **Reset to defaults** stay visible above the scrolling choices. Each front set occupies a full-width row; backs and fonts use grids. **Done** keeps changes; **Reset to defaults** restores Default fronts, Triangle back, and Classic rank font.

Choices save automatically under `hoq.appearance.v1`, using browser **localStorage** or native **AsyncStorage**, and survive reloads/restarts. This is independent of multiplayer identity storage. Appearance applies only to your view, including opponents' inspected hands, and stays consistent through Solo, Host/Join, rejoin, and return to the title screen. Other players keep their own appearance. Storage/font failures show a notice while play remains available; failed fonts can be retried. The selected font changes only rank glyphs on cards (and the rank samples in font choices). All interface text, inputs, special-card names, and descriptions use Classic, with a system fallback if Classic cannot load.

Below **House Rules**, expand **How to play** for bullet-point rules and card examples: four cards = 4 points, seven = 12, flush/straight bonuses, stacked bonuses, a bust, and thirteen cards winning immediately. Examples use the selected artwork and rank font and calculate points with the game scoring helper.

Expand **Meet the special cards** beneath it to see cards alongside their explanations. The guide includes all twelve action cards, four suit blanks, Rainbow Ace, and the all-suit blank generated by WAR. Collapse it again when finished. Action descriptions come from the same definitions used during play.

In **Solo** or **Host**, use the checkboxes beside these cards to select which specials enter the deck. War and Musical Chairs start unchecked and appear last with a warning that they can slow down large games; the other cards start checked; **Select all** and **Select none** are at the top of the expanded guide. Each suit blank and Rainbow Ace can be selected independently. The generated All-Suit Blank follows WAR and has no separate toggle. Selecting none leaves all 52 standard cards and preserves the usual scoring and turn rules.

Selections apply to the whole match, including later rounds and the second-deck refill. Hosts can also edit them in the multiplayer lobby before starting; guests see the host's choices as read-only checkboxes. The server locks settings while a match is active and retains them through reconnects, late joins, and host transfer. Title-screen selections stay while navigating modes/returning from play and reset to all on a fresh app launch; active online matches restore their settings from the server when rejoining.

This feature changes both frontend and backend. Rebuild/deploy both (backend first for compatibility). To review, try Select none in Solo, then a small subset; host an online table, check a guest sees the same choices, and verify subsequent rounds and reconnects keep them. No application builds were run for this change. Source tests passed for 79 frontend tests and 18 backend tests; two real localhost connection tests could not run successfully under the sandbox's network restriction and require a local rerun.

Manual checks: change each category independently, close/reopen and reload to check persistence, play Solo to compare the deck and hand with the preview, and reset. Expand/collapse the guide and inspect its last entries. On a phone, check portrait/landscape scrolling, `10` and long special-card names, and readable adjacent explanations. Verify modal dismissal with Done, Escape on web, and Back on Android, plus keyboard focus returning to the opener. Native device rendering still requires device testing.

## Code map and extension points

- `src/game/types.ts`: serializable card, state, command, and rule contracts. The engine is generic over the card type.
- `src/game/engine.ts`: pure state transitions, command validation, rounds, and results. No React, clocks, or I/O.
- `src/game/standardRules.ts`: Classic deck/scoring helpers and injectable shuffle.
- `src/game/specials/`: shared Fun deck, scoring traits, effect queue, serializable choices, registry and one module per action card. `view.ts` projects recipient-safe snapshots and bot inputs; queued jobs, secret commitments, and trap ranks never go to clients.
- `src/game/bots.ts`: independent bot policy using public hand/deck information, without draw order.
- `src/session/types.ts`: replaceable session/snapshot interface.
- `src/session/localSession.ts`, `funLocalSession.ts`: offline authority, injected randomness/clock, bots, decision deadlines, stale-choice protection, and cleanup. Fun UI receives projected snapshots, not internal effect state.
- `src/session/remoteSession.ts`: WebSocket adapter implementing the same gameplay interface plus lobby/connection state, rule configuration, persistence callbacks, reconnects, and explicit leave. It never computes authoritative game transitions.
- `src/session/platformStorage.ts`: browser localStorage and native AsyncStorage, plus secure UUID generation and backend URL selection.
- `src/appearance/`: typed catalogs, explicit bundled assets, validated durable preferences, an asynchronous font/selection controller, and the shared React provider. Catalog and controller tests run without loading binary assets.
- `src/ui/CustomizationPanel.tsx`, `SpecialCardGuide.tsx`: title-screen appearance controls and collapsible card reference. `src/game/specials/guide.ts` combines action definitions with passive-card explanations.
- `src/ui/`: React Native card/hidden-card rendering, mixed inventory, shared score previews, and `SpecialPanel.tsx` for descriptions and target/card/action choices between the deck and Hit/Quit buttons.
- `src/game/setup.ts`: supported turn-time choices and creation of one human plus 2–7 unique bot seats.
- `App.tsx`: composition root; selects Solo/Host/Join, composes the appropriate session adapter, and owns its lifetime.

Original 60 × 90 pixel assets retain their aspect ratio; web uses pixelated image rendering. Native uses the standard image renderer and should be checked on physical devices for sharpness. Native device builds and app-store publication are separate steps.

## Multiplayer

Start the backend from `hoq-be` with `npm ci`, `npm test`, and `npm start`. Host creates a table and shares its code. Only the host chooses rules and starts games/rounds. Table / Players provides player removal and a confirmation before ending the game for everyone. Host authority survives temporary disconnects; explicitly leaving transfers it to another member.

New players must wait until a game ends to join. Disconnected members keep their seat and resume the latest authoritative state. Normal timers still run; unlimited turns wait. Only explicitly departed or kicked seats are replaced by bots for the rest of the round. Completed and ended games return everyone to the menu with card/font customization and editable host rules. Replay keeps the same table code.

The private player ID, backend session ID, and endpoint are stored under `hoq.multiplayer.identity.v1` in browser **localStorage** or native **AsyncStorage**. The app automatically resumes a saved table on startup and reconnects on foreground/network restoration. Browser tabs share one identity; opening the same table elsewhere replaces the earlier connection. Use separate browser profiles/devices for different players. Explicit Leave clears the saved session. Closing or backgrounding the app preserves it. A table expires after 24 hours with everyone disconnected by default; a backend restart also loses its in-memory sessions.

Development defaults to the local backend: HTTP web uses its current hostname on port 8080, Android emulator uses `ws://10.0.2.2:8080/ws`, and iOS simulator uses `ws://localhost:8080/ws`. HTTPS development uses `wss://<current-host>/ws` and requires a local reverse proxy. Production builds, including `npm run build:web`, default to `wss://hoq.conkgames.com/ws`; nginx forwards that connection to port 8081 on EC2. No environment configuration is needed for these defaults.

`EXPO_PUBLIC_WS_URL` overrides the default in either mode. For physical-device development, set `ws://<computer-LAN-IP>:8080/ws` in `.env.development.local`. Avoid putting a local URL in a shared `.env`, since it would override the production URL during export too. Public Expo environment values are baked into exports; rebuild and redeploy after changing them. New native dependencies require rebuilding an existing development/standalone app.

Validation: frontend rule/session/storage tests, backend adapter integration tests, TypeScript checks, web/iOS/Android bundle exports, and browser checks of host/join, turns, reload/rejoin, host transfer, and solo bot play. Device runtime checks should still be performed on iOS and Android before release.

## iOS release checklist

### One-time Mac and Apple setup

1. Use a Mac with Node.js 22.13+, pnpm, CocoaPods, and an Xcode version compatible with Expo SDK 55 and Apple's current submission requirements. Open Xcode, complete installation, and select its Command Line Tools in Xcode Settings. Windows can edit the shared source and build the website, but cannot run Xcode or create a local signed iOS archive.
2. Enroll in the Apple Developer Program and sign in under Xcode Settings > Accounts. Register the explicit app identifier `com.jacobconklin.hitorquit` in the correct team, then create the matching iOS app record in App Store Connect. Team/account credentials are selected on the Mac and are not committed to this repository.
3. The iOS icon is configured in `app.json` as `expo.ios.icon: "./assets/hitorquit.jpg"`. This is a 1024 × 1024 copy of the root `hitorquit.jpg`, kept inside the frontend so native builds include it. If the source artwork changes, replace that copy and rerun `npm run prebuild:ios` on the Mac before archiving. Prepare the store description, support/privacy-policy URLs, privacy answers, age rating, review contact, and required iPhone/iPad screenshots. Answer export-compliance questions according to the actual app and libraries; do not blindly declare an encryption exemption.

### Changes and checks for every release

1. **Choose the version and build.** The first configured release is `1.0.0 (1)`. For each subsequent upload, increment `expo.ios.buildNumber` as a numeric string, including replacement TestFlight builds of the same version. For a new public release, also update `expo.version` and the frontend `package.json` version (for example, `1.0.1` for a fix or `1.1.0` for features). Update the current-release table above. Keep the bundle identifier stable and retain iPhone/iPad support.
2. **Check production configuration.** Release builds default to `wss://hoq.conkgames.com/ws`. Inspect shell and Expo `.env` overrides so `EXPO_PUBLIC_WS_URL` cannot bake a localhost/LAN URL into the archive. Public Expo environment variables are not secrets. Review changes to native dependencies, permissions, icons, config plugins, deployment targets, and privacy manifests when applicable.
3. **Install and validate.** From `hoq-fe` on the Mac:

   ```sh
   pnpm install --frozen-lockfile
   npm run typecheck
   npm test
   npm run build:web
   ```

   Run `npm test` in `hoq-be` when shared rules or multiplayer code changed. Check website behavior as well as native behavior. Keep the backend compatible with already-installed iOS versions: native updates reach players later than website deployments. Deploy compatible backend changes before clients need them, and account for active sessions being lost on a backend restart.
4. **Generate/update the native project.** From `hoq-fe`:

   ```sh
   npm run prebuild:ios
   open ios/*.xcworkspace
   ```

   This runs `expo prebuild --platform ios` and installs native dependencies. Open the `.xcworkspace`, not the `.xcodeproj`. The generated `ios/` directory is ignored by Git; app configuration and config plugins are the source of truth. Run prebuild again after version/configuration/native-dependency changes. If a clean regeneration is needed, first preserve any intentional native edits in config/plugins; `npx expo prebuild --platform ios --clean` deletes and recreates the generated iOS project.
5. **Verify Xcode settings.** Select the app target, choose the correct team under Signing & Capabilities, and enable automatic signing. Verify bundle ID, version, build number, iPhone and iPad device support, and deployment target against the intended release. Use the app scheme with Release configuration for Archive. Resolve signing/assets/privacy-manifest/build errors before uploading.
6. **Test native devices.** Test on iPhone and iPad, portrait and landscape, including narrow/resized iPad windows where available. Verify safe areas, scrolling, card/font customization and persistence, Solo without network, Host/Join between web and iOS, background/foreground recovery, force-close/reopen recovery, disconnected indicators, host kick/end confirmation, and replay with new rules. Also check a release build without Metro running. Simulator checks supplement physical-device checks.
7. **Archive and upload.** Select an iOS device or generic iOS device destination (not a simulator), then Product > Archive. In Organizer, validate the archive and use Distribute App > App Store Connect to upload. The release archive bundles JavaScript and assets. Keep the archive and its debug symbols for crash diagnosis.
8. **TestFlight and App Review.** Wait for processing in App Store Connect, resolve compliance prompts, and test the uploaded build through TestFlight on iPhone/iPad. Complete or update the listing, screenshots, privacy disclosures, review notes, and What's New. Select the intended build for the matching app version, submit for review, and choose the release timing. An upload alone is not publication. Give reviewers instructions for testing Solo and multiplayer; keep the backend available during review.
9. **Record the result.** Update the release record below with the exact version/build, source commit, date, validation completed, TestFlight/App Store status, and release notes. Mark a release published only after App Store Connect confirms it. Website-only changes do not update an installed native app; native code/assets/JavaScript changes require a new iOS build with the current setup (no OTA update workflow is configured).

### Release record

| Version | iOS build | Status | Notes |
| --- | --- | --- | --- |
| 1.0.0 | 1 | Source configuration prepared; not uploaded | Bundle ID `com.jacobconklin.hitorquit`; iPhone and iPad enabled. iOS icon configured from `hitorquit.jpg`. Native archive, device testing, signing and store metadata still required on Mac/Apple accounts. |

References: [Expo app configuration](https://docs.expo.dev/versions/latest/config/app/), [version and build numbers](https://docs.expo.dev/build-reference/app-versions/), [Xcode submission workflow](https://docs.expo.dev/submit/ios-manual/), [Apple build upload requirements](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

## Match results

Completed Solo and multiplayer games show a winner section followed by standings sorted by total points, with tied scores sharing a rank. Results include bust count, biggest hand (peak cards held at once, including the busting card), and best round (most points banked in one round). Peak hand size is tracked during play, including special-card effects; each completed round saves that peak and each player's final status alongside the existing scores. These records survive reconnects and new rounds, and reset with a new match. Previous participants remain in the results even if they left the table. Older server snapshots without detailed stats show a dash rather than invented zeros. Deploy the backend as well as the frontend to collect multiplayer statistics; no native version/build bump is implied by this source change.

### Multiplayer bots

The host can use **ADD BOT** or remove bots in the lobby and after a match. Humans plus bots may occupy at most eight seats. A host can play with just bots, or mix bots and friends. Bots remain through rounds and rematches; roster changes wait until the match ends. They are labeled BOT in the lobby and are never shown as disconnected humans.

Decisions run on the authoritative server with a minimal scheduling delay, so the host device does not need to stay active to control bots. Human special-card choices still wait for input. New clients hide Add Bot on servers without bot support. Deploy backend before frontend; existing iOS clients remain compatible, but need a new native build to gain the controls.
