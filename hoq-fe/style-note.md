# Hit or Quit — Style Notes

## Pixel art

Game artwork is supplied as pixel art in `game-art/`, currently organized into `card-fronts/`, `card-backs/`, and `fonts/`.

Scale artwork up appropriately for the display while preserving sharp pixel edges. Prefer integer scale factors where practical, preserve source aspect ratios, and use nearest-neighbor/pixelated rendering where supported. Verify scaling on native and web targets; avoid smoothing, stretching, or cropping the border designs. Determine card dimensions and text placement from the supplied images when implementing the renderer.

## How face-up cards are built

Card-front images provide the decorative outer design and suit color. The rank is not a separate baked-in image: superimpose rank text over the front using the selected font, positioned within the design's clear interior.

| Suit | Front color | MVP asset |
| --- | --- | --- |
| Spades | Blue | `game-art/card-fronts/default/blue.png` |
| Clubs | Green | `game-art/card-fronts/default/green.png` |
| Hearts | Red | `game-art/card-fronts/default/red.png` |
| Diamonds | Yellow | `game-art/card-fronts/default/yellow.png` |

Render ranks as A, 2–10, J, Q, and K. Keep text legible and fit the two-character rank 10 without covering the border. Card identity and scoring come from rank/suit data, never from image colors or filenames. Give cards accessibility labels containing both rank and suit.

## Card backs

Card backs are used only for the deck and face-down portions of dealing animations. Face-up hands use the suit-colored front with superimposed rank text. After a dealt card is revealed, display its front.

## Player customization

The title-screen **Customize cards & font** panel offers independent front, back, and font choices with a live preview and automatic local persistence. `src/appearance/catalog.ts` owns stable IDs and names; `assets.ts` maps them to explicit bundled asset imports. `AppearanceProvider` applies the resolved choices across the menu, lobby, and game without changing gameplay logic.

First-launch and reset defaults remain:

- **Card fronts:** `game-art/card-fronts/default/`.
- **Font:** Classic, from `game-art/fonts/Classic.ttf`.
- **Card back:** Triangle, from `game-art/card-backs/triangle.png`.

Available fronts are Default, Elements, Flowers, Swords, and Tetra. Each is a complete four-suit set with the established blue/green/red/yellow mapping. Flowers uses the four `*-small-flower.png` files, excluding the older oversized yellow image. All eight backs and thirteen fonts are selectable. Fonts load on demand for the selected appearance and panel samples, with Classic/system fallback and retry if loading fails.

To add a choice, add its stable ID/name to the catalog and its static `require(...)` sources to the typed asset registry. A front set must include all four suits. Do not import `.meta`, `.aseprite`, or superseded artwork. Persist only IDs; removed IDs fall back independently to defaults. Keep all assets local and preserve the clear rank area, aspect ratio, and pixelated web scaling.

The selected font applies only to rank glyphs on cards and the font-option rank samples. Labels, buttons, title-screen inputs, customization controls, special-card names, and descriptions always use Classic (system fallback only on load failure). Special/rainbow/all-suit cards retain their plain frame; hidden cards retain `?` and never expose concealed values. The no-card draw deck uses the selected back.

Keep the customization preview and Reset/Done controls outside the scrolling options so they remain visible. Preview four ranked cards and a back, without a special-card stand-in or promotional text. Front options each occupy an entire row; back and font options retain their wrapping grids. Scale the preview to fit narrow and short viewports.

The collapsible **Meet the special cards** section follows setup on the home page. Pair each card with a wrapping explanation beside it and reuse the actual card renderer so it follows the player's choices. Action explanations come from the live special registry; include passive blanks, Rainbow Ace, and WAR's all-suit blank reward as well.

## Table layout

Use separate responsive arrangements instead of requiring landscape orientation. The current breakpoint is 1024 logical pixels: narrower windows use the mobile stack, wider windows use the desktop table.

The pre-game menu uses a top-aligned vertical scroll on mobile, with the introduction followed by the settings and Deal Me In button. Sections fill the available width up to 520 pixels and retain their natural height. Target-score and turn-time options stack as full-width touch buttons; bot counts use a three-column grid. Keep the desktop menu side by side when space permits.

On mobile, place everything in one vertically scrolling page: opponents one per row at the top, then the scoreboard button and deck, turn information, centered Quit and Hit buttons, and finally the local hand. Keep buttons separated by a clear gap. Use readable 72 × 108 cards that wrap to additional rows rather than squeezing the hand into one line. Scroll to the bottom once at match start; do not force the scroll position on subsequent turns, card draws, or panel dismissals.

On desktop, preserve the wide table: opponents across the top, deck and scoreboard button in the center, and centered action buttons immediately above the hand. Let the entire page scroll vertically when the viewport is too short. Allow header/footer content to wrap and keep controls and cards at usable sizes.

Support portrait and landscape on native and web; no orientation lock or rotate-device overlay. Respect device safe areas. Keep pop-ups bounded by the viewport and scroll their contents when needed. The scoreboard can widen to 1000 pixels on desktop to fit eight players, with horizontal scrolling on narrow screens. The deck grid retains its rank columns and suit rows, with horizontal scrolling when necessary.
