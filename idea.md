# Hit or Quit

Hit or Quit is a multiplayer online card game about deciding whether to risk drawing another card or keep the points already in your hand. It uses a standard deck of playing cards, with extra fun cards planned for later.

## Project structure and platforms

This root folder contains the whole project so the frontend and backend can be run and understood together:

- `idea.md`: the app concept, rules, and intended experience.
- `hoq-fe/`: the React Native frontend, intended to support iOS, Android, and web browsers. Native versions may be released through the iOS and Android app stores.
- `hoq-be/`: the WebSocket backend, running on AWS EC2 and responsible for storing and managing multiplayer game state and events.

Single-player games against bots will be available from the start, both for testing and offline play. The frontend must therefore be fully playable on its own without the backend. Online multiplayer uses the backend to maintain shared state and coordinate game events.

## Game rules

### Rounds and turns

At the start of every round, each participating player is automatically dealt exactly **one normal (standard) card**. Opening cards are never special cards, including when playing with future fun-card rules. Players take turns choosing one of two actions:

- **Hit:** draw one additional card into your hand. If the hand contains two cards of the same rank, you instantly **bust**, leave the round, and score zero points for that round.
- **Quit:** keep your current hand and its points, leave the round, and wait until the next round before hitting again.

A round ends when all players have either quit or busted. Players then begin the next round with one automatically dealt normal card each.

### Scoring

A player who quits scores the following for their hand:

| Condition | Points |
| --- | --- |
| Each card in the hand | 1 per card |
| Flush: five cards of the same suit | +3 |
| Straight: five cards with consecutive ranks | +3 |
| Reach seven cards | +5 |

Bonuses are added to the points for the cards. Straights follow normal poker rules for aces: an ace can be low in A–2–3–4–5 or high in 10–J–Q–K–A, but sequences cannot wrap around from king through ace to two.

A busted hand scores zero for the entire round, regardless of its cards or bonuses. Scores accumulate across rounds. The first player to reach the configured target score wins; the default target is **30 points**.

### Turn timer

Players can choose **10 seconds** (default), **30 seconds**, or **unlimited** per turn. If a player does not act before a timed turn expires, **Hit** is chosen automatically. Unlimited turns have no automatic Hit. Single-player setup supports **2–7 bots**, defaulting to 2.

## UI and interaction

Mobile supports portrait and landscape with a dedicated **vertically scrolling layout**. From top to bottom: other players stacked one per row, the scoreboard button and deck, turn information and the Quit/Hit buttons, then the local player's hand. Cards wrap into readable rows. A new mobile match initially scrolls to the bottom so the player can reach their hand and actions immediately; later updates do not reset the user's scroll position.

Desktop retains the wide table appearance: other players across the top, the deck and scoreboard button in the center, and the local hand below centered Quit and Hit buttons with a clear gap. Shorter desktop windows scroll vertically instead of compressing or clipping the table. The layout switches based on available width, with the mobile stack used below 1024 logical pixels.

Clicking or tapping another player displays their cards. The active player is highlighted. Pop-ups stay within the viewport and scroll when needed. There is no orientation lock or rotate-device blocking screen.

The scoreboard shows every player's score for each round, with totals at the top. Players can swipe or use arrows on the right to switch to a view of the current deck contents. **Card counting is encouraged.**

## Initial playable MVP

The next step is to prototype a playable version with the standard deck, turn-based Hit and Quit actions, duplicate-rank busts, scoring, rounds, a configurable target score, and a configurable turn timer.

Single-player bot opponents and standalone offline frontend play are part of the initial implementation. Online multiplayer will use the WebSocket backend for shared game state and events. The core rules should behave consistently in both modes.

Extra fun cards are a later extension.

## Details to settle during prototyping

- Whether reaching seven cards automatically ends a player's round or allows further hits.
- How overlapping or multiple straights and flushes in a larger hand affect bonuses.
- How to handle ties or multiple players reaching the target score in the same round.
- Deck reshuffling, deck exhaustion, player limits, and multiplayer disconnect behavior.
