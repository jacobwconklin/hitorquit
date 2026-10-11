# Implemented specials

- Available in Solo and multiplayer through the same engine, choice controls, and bot/timeout handling.
- Each deck contains 52 normal cards plus **one of each below** (four separate suit blanks): **67 cards** total. Every round starts with one normal card per player. Once the draw pile falls below 13, shuffle in one complete second deck, including its specials; no third deck this round.
- **Daily Double:** choose a player, including yourself; their Hits draw two cards for the rest of the round. Repeated copies do not stack.
- **Musical Chairs:** drawer chooses left/right; each participating player secretly selects one card, then all selected cards move together.
- **Suit blanks — Spades, Clubs, Hearts, Diamonds:** rankless cards that count toward hand size, points, and their suit's flush; no rank pairs or straights.
- **Rainbow Ace:** one Ace belonging to every suit. Pairs with another Ace; supports either Ace straight.
- **Even or Odd:** choose yourself or another player; they guess parity of a random 0–9 result. Success lets them choose one suit for their whole current hand; failure changes every current card's rank to Ace.
- **Draw 3:** choose a player, including yourself, to draw three without quitting between draws.
- **Steal Card:** select another player, then the exact card to take.
- **Blindfold:** another player sees `?` cards and no scores/deck inventory until their next personal turn fully ends. Multiplayer also removes restricted data from their snapshots.
- **Ransom:** select another player and the exact card demanded; they surrender it or Hit.
- **Booby Trap:** secretly choose a rank when drawn. The first opponent who draws that rank and survives draws one extra card. An armed trap persists across rounds until triggered.
- **WAR:** participants secretly submit cards; highest gets a generated all-suit blank, lowest receives up to three randomly selected submissions; unused submissions are discarded.
- **Chicken:** choose an opponent; both privately commit Hit/Quit each step. Both Hit continues if both survive; both Quit banks with no penalty. A lone surviving hitter chooses a card to steal from the quitter before the quitter banks. No extra points.

## Assumptions you may want to change

- Targets/contributors must still be playing; empty hands skip Musical Chairs/WAR. Stealing the final card is allowed. Quit/busted hands are protected except Chicken's penalty before banking.
- Action specials replace the normal drawn card and resolve immediately, without remaining in the scoring hand. Booby Trap arms immediately rather than being held for later. Unusable specials are consumed without a replacement draw.
- Preserved current code: seven cards gives +5 and allows further Hits; thirteen safe cards wins immediately, including blanks. Each bonus category applies once.
- Forced draws resolve sequentially, stop for that player on bust/victory, and pause for any drawn special's choices. Daily Double changes chosen Hits, Chicken Hits, and Ransom refusals; Draw 3 stays three and a trap adds only one.
- Chicken commitments are secret; draws resolve in table-seat order. Both committed Hits still execute if the first player busts. A pending quitter remains vulnerable to nested specials until banking; thirteen-card victory immediately cancels remaining effects.
- WAR: Ace is high, rankless blanks are zero, ties are random with distinct winner/loser. The loser's own submission can return to them. Its all-suit reward counts as one physical card.
- Even or Odd transforms only cards currently held. Five cards are still needed for a flush; a one-card cursed hand does not bust. Overrides travel with stolen/transferred cards and reset with the next round's fresh hands.
- Blindfold starts immediately, includes special choices in the next personal turn, and clears early if the target quits/busts. Previously seen cards cannot be forgotten; neutral card positions remain selectable.
- Traps skip their owner, opening deals, and draws that already bust/win. Multiple matching traps each add a draw; armed traps remain after the owner quits, busts, or leaves, but reset for a new match.
- Each special choice gets a fresh match-length timer; timeout picks the first legal option (Chicken defaults to Hit). Unlimited stays unlimited. Reconnect preserves the current deadline; disconnected players' bots finish pending choices.
