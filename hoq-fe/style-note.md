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

Players will eventually be able to select a card-front set, a card back, and a font. Keep these as independent theme choices in a reusable asset registry so the renderer can apply selections consistently without changing gameplay logic.

Cosmetic selection controls are deferred. For the MVP, use only:

- **Card fronts:** `game-art/card-fronts/default/`.
- **Font:** Classic, from `game-art/fonts/Classic.ttf`.
- **Card back:** Triangle, from `game-art/card-backs/triangle.png`.

Bundle these assets locally so rendering does not require a backend or remote font service. Other supplied assets remain available for future customization.

## Table layout

Use separate responsive arrangements instead of requiring landscape orientation. The current breakpoint is 1024 logical pixels: narrower windows use the mobile stack, wider windows use the desktop table.

The pre-game menu uses a top-aligned vertical scroll on mobile, with the introduction followed by the settings and Deal Me In button. Sections fill the available width up to 520 pixels and retain their natural height. Target-score and turn-time options stack as full-width touch buttons; bot counts use a three-column grid. Keep the desktop menu side by side when space permits.

On mobile, place everything in one vertically scrolling page: opponents one per row at the top, then the scoreboard button and deck, turn information, centered Quit and Hit buttons, and finally the local hand. Keep buttons separated by a clear gap. Use readable 72 × 108 cards that wrap to additional rows rather than squeezing the hand into one line. Scroll to the bottom once at match start; do not force the scroll position on subsequent turns, card draws, or panel dismissals.

On desktop, preserve the wide table: opponents across the top, deck and scoreboard button in the center, and centered action buttons immediately above the hand. Let the entire page scroll vertically when the viewport is too short. Allow header/footer content to wrap and keep controls and cards at usable sizes.

Support portrait and landscape on native and web; no orientation lock or rotate-device overlay. Respect device safe areas. Keep pop-ups bounded by the viewport and scroll their contents when needed. The scoreboard can widen to 1000 pixels on desktop to fit eight players, with horizontal scrolling on narrow screens. The deck grid retains its rank columns and suit rows, with horizontal scrolling when necessary.
