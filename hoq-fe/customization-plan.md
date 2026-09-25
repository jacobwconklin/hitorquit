# Title-screen customization plan

## Objective and scope

Let players independently choose a card-front set, card back, and font from the title screen, preview the result immediately, and retain their choices across launches. Apply their choices throughout Solo, Host, Join, and rejoined games.

Recommended scope: these are local viewing preferences. Every card a player sees uses that player's selections, including inspected opponent hands. Other clients keep their own preferences; no backend, game rules, card data, or WebSocket protocol changes are needed. Use one font choice for card text and interface text, matching the existing shared `Label` design. Separate card/UI font choices, account synchronization, uploads, and in-match customization are outside this first implementation.

This document is a plan; the customization feature is not implemented by this change.

## Current implementation

| Area | Current behavior | Required change |
| --- | --- | --- |
| `App.tsx` | Owns the title/setup screen, renders three sample cards, and loads only Classic using `useFonts`. | Add customization controls and previews; place shared appearance state above the title/session branches; move font loading into that lifecycle. |
| `src/ui/theme.ts` | Exports fixed `cardTheme` assets and table colors. | Replace fixed card/font selections with registries and defaults; keep table colors independent. |
| `src/ui/components.tsx` | `PlayingCard` reads fixed fronts/back; `Label` captures the Classic family in a module-level stylesheet. `Hand` and `Button` reuse these components. | Read the resolved appearance reactively so every existing consumer updates. |
| `src/ui/GameTable.tsx`, `SpecialPanel.tsx` | Render the deck, hands, inspected hands, and effect/choice cards through shared components. | Verify inherited appearance across all these surfaces; avoid passing cosmetic choices into sessions. |
| `src/ui/MultiplayerRoom.tsx` | Uses shared labels/buttons and routes active players to `GameTable`. | Inherit the same provider through lobby, waiting, and gameplay screens. |
| `src/session/platformStorage.ts` | Uses browser **sessionStorage** or native AsyncStorage for multiplayer identity. | Add separate durable appearance storage; preserve the existing identity lifetime and key. |
| `style-note.md` | Already specifies independent front/back/font choices, bundled assets, and pixel-art constraints, but defers controls. | Update the customization guidance when implementation ships. |

### Available assets and the front-set gap

- **Fronts:** only `game-art/card-fronts/default/` exists. It maps spades to `blue.png`, clubs to `green.png`, hearts to `red.png`, and diamonds to `yellow.png`. These four images are the four suits of one set, not four selectable sets.
- **Backs:** eight choices are available in `game-art/card-backs/`: Blocks, Blue Diamonds, Celestial, Houndstooth, Purple Diamonds, Red Diamonds, Triangle, and Web.
- **Fonts:** thirteen choices are available in `game-art/fonts/`: Classic, Chakra Petch, Doto, Galada, Major Mono Display, Mea Culpa, Mystery Quest, Nixie One, Rampart One, Ribeye Marrow, Rye, Silkscreen, and Sofia. Classic uses `Classic.ttf`; the others use their existing `*-Regular.ttf` filenames.
- **Defaults:** preserve Default fronts, Triangle back, and Classic font for first launch and reset.

Actual front switching requires at least one additional complete front set. Create or obtain four alternate suit images, place them in a new `game-art/card-fronts/<set-id>/` directory, and register them before calling front customization complete. Keep the established suit/color mapping and a clear interior for rank overlays. Follow the existing 60 × 90 proportions and pixel-art style. A one-option Default selector can support development, but it does not satisfy the final front-switching requirement.

## Player experience

1. Add a **Customize cards & font** entry to the title screen, available in Solo, Host, and Join before starting or rejoining a table. Open a bounded, scrollable panel using the app's existing modal conventions.
2. Provide three independent groups: **Card fronts**, **Card backs**, and **Font**. Show named front-set thumbnails, back thumbnails, and font samples. Indicate the selected item with both a visible marker and accessibility selected state.
3. Show a combined live preview using the real card renderer: all four suits, a rank `10`, a face card, a back, and representative special-card text. Include a short UI text/button sample so players can assess the selected font beyond ranks. Let previews wrap on narrow screens.
4. Apply selections immediately and save automatically. Closing with **Done**, Escape, or native Back keeps the selection; do not present Cancel semantics. Include **Reset to defaults**, which resets all three preferences and saves them.
5. Keep title-screen sample cards synchronized with the selected appearance after the panel closes. Starting, leaving, or rejoining a game must preserve the choices.
6. Keep the current responsive layout: narrow screens below 1024 logical pixels scroll vertically; wide screens keep the existing title/setup arrangement. Customization must not make play controls unreachable.

Provide text names for artwork, keyboard-operable choices on web, visible focus, usable touch targets, and appropriate modal focus/return behavior. Font names and failure messages should retain a readable fallback even if a decorative font has poor readability.

## Implementation design

### 1. Typed asset catalog and preferences

Add `src/appearance/catalog.ts` for stable option IDs, display labels, defaults, and pure preference validation. Add `src/appearance/assets.ts` for the corresponding bundled image/font sources. Separate metadata from asset imports so Node tests can validate settings without attempting to execute PNG/TTF imports.

Use explicit static `require(...)` calls for each supplied asset so Expo can bundle them; do not construct asset paths from a saved ID. Each front-set entry must supply a complete `Record<Suit, ImageSourcePropType>`. Keep front-set, back, and font registries independent so every valid combination works.

Persist only versioned IDs, for example:

```ts
type AppearancePreferences = {
  version: 1;
  frontSetId: FrontSetId;
  backId: BackId;
  fontId: FontId;
};
```

Resolve these IDs to sources and font metadata at render time. Font metadata should include a unique registered family name; add measured size/line-height adjustments only where preview testing demonstrates a need. Avoid storing resolved asset objects, platform asset numbers, or paths in preferences.

### 2. Shared state and durable storage

Add `src/appearance/AppearanceProvider.tsx` and a `useAppearance()` hook. Expose preferences, resolved artwork, the usable font family, hydration/loading status, selection/reset actions, and nonblocking error state. Mount it above all title, local-game, and remote-game branches in `App.tsx`; do not recreate it when the game session changes.

Add a pure, injected-storage preference store in `src/appearance/preferenceStore.ts` and a platform adapter in `src/appearance/platformStorage.ts`:

- Use a dedicated key such as `hoq.appearance.v1`.
- Use browser `localStorage` for persistence across browser restarts and native AsyncStorage for app restarts. Keep multiplayer identity on its current sessionStorage/native adapter.
- Validate parsed JSON as untrusted stored data. Missing, corrupt, or unsupported-version records resolve to defaults. For a supported record, fall back independently for unknown or removed IDs while retaining other valid choices.
- Hydrate once. Disable selection controls until hydration finishes and never save initial defaults before that read completes, preventing saved choices from being overwritten at startup.
- Serialize saves so rapid selections or reset cannot leave an older value as the last stored preference. A failed write must not prevent subsequent saves.
- Catch read/write failures, retain usable in-memory choices, and display a brief message that preferences could not be saved/restored. Storage failures must not block play.

Preferences belong to the local browser profile/app installation, not to a multiplayer seat. Live synchronization between already-open browser tabs is optional and outside this first version.

### 3. Font loading and fallback

Replace the Classic-only startup path in `App.tsx` with provider-managed loading using the existing `expo-font` dependency. Bundle all registered font sources, load Classic and the saved selection on startup, and lazily load other selected/previewed fonts with a cache. Avoid making every font a prerequisite for entering the game.

Keep the previous successfully loaded family visible while a requested font loads. Track the latest requested ID so a slow response from an earlier click cannot override a newer choice. Apply and persist a newly selected font only after loading succeeds; on failure retain the prior working choice and offer retry. If a saved font fails at startup, show a notice and use Classic, or the system font if Classic also fails, without trapping the app on a loading screen.

Only pass a custom `fontFamily` to text after it is loaded. Font-option samples may use their own loaded family, while the rest of the preview uses the selected family. Evaluate all supplied fonts for digits, A/J/Q/K, punctuation, arrows, accents in player names, and special-card names; provide fallback rendering for missing glyphs and adjust constrained text layouts based on actual results.

### 4. Shared rendering changes

- **`Label`:** move the chosen `fontFamily` out of the static stylesheet and apply it from the provider at render time. Preserve caller style overrides so font tiles can demonstrate another family.
- **`PlayingCard`:** resolve suit images from the chosen front set and the no-card draw-deck image from the chosen back. Preserve card IDs, rank/suit overrides, accessibility labels, and entrance animation behavior. Cosmetic changes must not remount cards or restart a game.
- **Special rendering:** preserve the existing plain black/white treatment for special, rainbow, hidden, and all-suit cards. The font choice still applies to their text. In particular, `kind: 'hidden'` currently displays `?`; keep that information-hiding behavior distinct from the no-card deck back. A back change must never expose rank/suit information.
- **Text inputs:** apply the usable selected font to the name and join-code `TextInput` styles in `App.tsx`; these do not use `Label` today. Verify placeholder/caret and six-character code legibility.
- **Sizing:** preserve the 1:1.5 card aspect ratio, contained image scaling, and web pixelated rendering. Check the current renderer's small widths (including 48, 60, 64, 66, and 72) as well as larger cards. Fit `10` and long special names inside the artwork without cropping borders.

`Hand`, `Button`, rule controls, deck inventory, opponents, scoreboard, and lobby should inherit changes through shared components. Review fixed cell widths and line heights for decorative fonts; allow wrapping or measured sizing adjustments where required.

### 5. Title-screen panel and documentation

Add `src/ui/CustomizationPanel.tsx` for the selectors and combined preview. Keep catalog/storage logic out of this component. Reuse `PlayingCard` for the active combined preview; option thumbnails can read catalog assets directly without temporarily changing the global selection.

Wire panel visibility and its entry button into `App.tsx`. Remove the old Classic-specific loading/error message once the provider owns that behavior. Update `README.md` with selection, persistence, reset, and local-only multiplayer behavior; update `style-note.md` to replace the deferred-controls note with the implemented behavior and asset-registration guidance.

## Delivery order

1. Supply and review at least one alternate front set; confirm names and catalog IDs for existing backs/fonts.
2. Add typed metadata, asset registries, defaults, preference validation, and the durable storage adapter.
3. Add the provider and font-loading lifecycle, then connect shared rendering and text inputs.
4. Add title-screen controls, previews, reset, accessibility, and nonblocking failure messages.
5. Validate behavior and layout, then update documentation.

No new runtime package is expected: React context, React Native controls, `expo-font`, and AsyncStorage are already available. Additional front artwork is the only missing content required for all three categories to offer real choices.

## Validation and completion criteria

Add focused Node tests using the existing `node:test` setup for preference defaults, corrupt/unknown records, independent fallback, reload persistence, reset, storage failures, and ordered rapid saves. Add coverage for hydration protection and stale font-load completion where the implementation exposes testable asynchronous logic. Keep these tests independent of React Native and binary asset imports; ensure `tsconfig.test.json` includes any new pure modules needed by the tests.

After implementation, run `npm test`, `npm run typecheck`, and `npm run build:web` from `hoq-fe`. Check iOS/Android asset bundling and exercise available native devices/emulators, recording any untested platform rather than treating a web export as native runtime validation.

Manually verify:

- At least two complete front sets, all eight backs, and the thirteen supplied fonts are selectable; each category changes independently.
- Combined and title previews match gameplay; changing one choice preserves the other two. Reset restores Default/Triangle/Classic.
- Refresh/browser restart and native restart restore selections. Corrupt storage, blocked storage, and font failures leave the game usable.
- Rapid font changes cannot apply an outdated font; unrelated front/back changes remain responsive while a font loads.
- Solo, multiplayer lobby, host/join, rejoin, own hand, inspected hands, deck, special choices, scoreboard, and return to title use the local appearance consistently.
- Two multiplayer clients can use different appearances without affecting each other's settings, game configuration, or game state.
- Hidden cards remain hidden, rank/suit accessibility labels remain accurate, and scoring/timers are unchanged.
- All fonts are readable at narrow portrait and wide desktop sizes; ranks, long special names, inputs, buttons, and score cells do not clip. Artwork remains sharp and uncropped.
- Keyboard, screen-reader, touch, modal dismissal, and return focus work on supported targets.

Completion requires working selections in all three categories, persistent preferences with safe fallback, consistent local rendering across modes, and verified responsive previews. Registering only the existing Default front set is not sufficient.
