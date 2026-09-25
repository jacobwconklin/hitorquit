# Hit or Quit — Frontend MVP Plan

## Goal and scope

Build a playable React Native single-player game against local bots on web, iOS, and Android. Use a vertical scrolling mobile layout and a wide desktop table, supporting both orientations. Follow the game concept in `../idea.md` and the presentation rules in `style-note.md`.

The MVP has no backend connection, WebSocket client, authentication, or dependency on `hoq-be`. All gameplay runs locally and must work offline once the app and bundled assets are available. Browser offline availability requires the app assets to have been cached; a first visit still requires delivery of the web app.

This document plans the implementation; project scaffolding and coding come next.

## Reusable architecture

Keep game rules, session coordination, bot decisions, and presentation separate. Use TypeScript and plain serializable data for cards, players, configuration, round history, and session snapshots.

### Game rules

- Implement pure functions for deck creation, legal actions, drawing, duplicate-rank bust detection, scoring, turn progression, round completion, and victory checks.
- Accept a state and an explicit command, and return the next state plus game events. Do not import React Native, assets, networking, timers, or device APIs into the rules layer.
- Keep random deck shuffling outside state transitions. Supply a shuffled deck or injectable random source so tests can reproduce games.
- Represent ranks and suits independently of artwork and fonts. Preserve unique card IDs for rendering and animations.
- Keep configurable rules in one place, including the target score (default 30) and turn duration (10 seconds by default, 30 seconds, or unlimited).

### Session interface

- Present the UI with a small session interface: read a snapshot, subscribe to snapshots/events, submit a player command, and dispose of the session.
- Implement a local session adapter that owns state, applies commands through the rules engine, schedules bots and timeouts, and publishes updates.
- Make the session authoritative: validate player identity, active turn, game phase, and legal action even if the UI has disabled an action.
- Tag commands and deadlines with turn identifiers so stale clicks, delayed bot actions, and timeout races cannot apply twice or affect the next turn.
- Expose the current turn deadline in session state; the UI only displays the remaining time. Inject a clock/scheduler into the local session for testing and clean up scheduled work on restart or disposal.
- Keep UI overlays, selected opponent, and animation progress separate from game state.
- Allow a future adapter to supply snapshots and events from managed session state or a backend through the same interface. Components must not directly mutate game state or depend on the local engine implementation.

### Bots

- Give bots the same Hit and Quit command path as the human player.
- Keep bot decision policy separate from the session and rules engine, with injectable randomness for reproducible tests.
- Begin with a simple policy that weighs the current hand and duplicate-rank risk. Bots may inspect information visible to players, including remaining deck contents, but not future deck order.
- Use a short scheduled decision delay so turns can be followed visually. The normal timeout still defaults to Hit.

### Presentation and assets

- Build components for the table, player hand, card, opponent icon, turn timer, action buttons, deck, central overlays, scoreboard, and deck inventory.
- Render cards through one reusable component and an asset/theme registry, following `style-note.md`.
- Consume session snapshots for rendering and session events for dealing/bust feedback. Animations must not determine game outcomes or block state correctness.

## Gameplay to implement

1. Start a local match with a human and 2–7 bots (default 2). Provide target-score and turn-duration settings; use 30 points and 10 seconds by default, with 30-second and unlimited options. Unlimited turns never auto-hit; bots continue to make decisions normally.
2. Deal one card to each player at the beginning of every round.
3. On the active player's turn, accept Hit or Quit. An expired deadline submits Hit automatically.
4. A Hit draws one card. A duplicate rank immediately busts the player and gives them zero points for the round.
5. A Quit banks the hand's score and removes the player from further turns in that round.
6. Award one point per card, plus 3 for a five-card flush, plus 3 for a five-card straight, plus 5 for reaching seven cards. Aces may be low or high in a straight, without wrapping.
7. Skip players who quit or busted. When everyone is finished, record round scores, show the result, and advance to the next round or game result.
8. Support replay and return to setup without leaving old bot or timer work running.

## Provisional rules for the first prototype

The following resolve open details in `../idea.md` for implementation and can be revised independently of the UI:

- Start with one human and a selectable 2–7 bots. Keep the seat list extensible in code.
- Use a fresh shuffled 52-card deck each round, shared by all players and drawn without replacement.
- Automatically bank a surviving seven-card hand and end that player's round. A large table can exhaust the deck; a Hit on an empty deck banks the current hand.
- Award each bonus category at most once per hand. Five or more cards of a suit qualify for the flush; any valid five-rank run qualifies for the straight. Bonuses can stack.
- Check the target after the round completes so all players finish that round. Highest total at or above the target wins; tied highest totals share victory in the MVP.
- Rotate the starting player each round.
- Inspecting hands or opening the scoreboard/deck inventory does not pause the turn timer. When the app resumes after suspension, resolve the expired active turn once and start the next turn with a fresh deadline.

## Screen and interaction plan

- Below 1024 logical pixels wide, use one vertical scroll container: opponents stacked one per row, scoreboard button and deck, turn information and centered Quit/Hit buttons, then the human hand. Wrap cards at a readable size. Initially scroll to the bottom once when the match starts; subsequent updates preserve the user's scroll position.
- On wider desktop screens retain the table appearance with opponents across the top, deck in the center, and centered Quit/Hit buttons directly above the hand. Keep a clear gap between actions. Disable actions outside the human's active turn.
- Highlight the active player and show who has quit or busted. The mobile player list scrolls as part of the page, rather than inside a separate vertical scroller.
- Clicking or tapping an opponent opens their cards in a central overlay.
- Place the deck in the desktop center with the menu beside it; on mobile place the menu above the deck. Show dealing feedback from the deck to the receiving player.
- Use central overlays for setup, hand inspection, round results, and match results.
- Open the scoreboard from the menu: totals at the top, per-round scores beneath. Support swiping and arrows on the right to switch to the remaining-deck inventory.
- Show the actual remaining cards in the deck inventory; card counting is part of play.
- Keep controls usable across portrait/landscape phones, tablets, and browsers, respecting safe areas. Remove the orientation lock and rotate-device overlay. Allow short desktop windows to scroll vertically instead of compressing content. Bound pop-ups to the viewport, with scrolling where needed.
- Include readable rank text, visible action labels, and accessibility labels for cards and controls.

## Implementation sequence

1. Scaffold the React Native frontend with TypeScript and web support; bundle the supplied local assets and Classic font.
2. Implement the pure rules engine and focused rules tests.
3. Implement the local session adapter, timer handling, and bot policy; verify complete matches without UI dependencies.
4. Build the responsive mobile stack, desktop table, and card rendering using the fixed MVP theme.
5. Connect setup, player actions, opponent inspection, scoreboard, deck inventory, round results, and replay.
6. Add lightweight deal animations and clear bust/quit feedback, then verify a full playable match across target layouts.

## Acceptance checks

- A human can complete a match against bots with no backend running or contacted.
- Duplicate ranks bust immediately; quit hands and all bonus combinations score correctly, including ace-low and ace-high straights and invalid wraparound sequences.
- Timeout always chooses Hit, and a click arriving alongside a timeout cannot cause two actions.
- Finished players are skipped, rounds record scores exactly once, and match results follow the configured target and provisional tie rule.
- Bots use legal actions, and replay/disposal cancels stale scheduled actions.
- Scoreboard totals match round history; the deck inventory matches cards still available to draw.
- Cards use the required fronts, font, suit colors, and triangle back, with crisp pixel-art scaling.
- On narrow mobile screens, every opponent, control, and card remains reachable by vertical scrolling; matches initially show the bottom of the table. Seven-card hands wrap without shrinking to unreadable sizes. Short desktop viewports scroll without clipping the hand.
- The UI obtains gameplay state through the session interface, allowing a future backend adapter without rewriting game components.

## Deferred work

Online multiplayer, backend integration, accounts, matchmaking, extra fun cards, cosmetic selection controls, and app-store publication are outside this MVP. Design the asset registry for cosmetic selection now, but use only the fixed MVP theme.
