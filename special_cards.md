# Special cards: rules and implementation design

Status: **design in progress; selected concepts accepted for the candidate list, one-normal-card opening rule settled, no special cards implemented.** Acceptance into this list is not approval to implement a card or all of its edge cases.

This is the working document for choosing fun cards and agreeing on a consistent way to execute them in Solo and multiplayer. Names, quantities, durations, and the rules below are proposals. Mark individual decisions accepted here before using them as implementation requirements.

**Current direction:** collect ideas, weed them down, then flesh out the survivors before implementation. The user will decide remaining shared rules after consideration. Prefer interaction, sabotage, and changes to cards over adding lots of extra points. The earlier five-card preset is superseded as a recommendation; it remains below only as an earlier illustrative design. New candidates include held cards, scoring cards, simultaneous choices, and persistent pots/traps. Additional assistant pitches stay in conversation until the user chooses which to record.

## Settled rules and selection direction

- **Opening hands:** at the start of every round, automatically deal every participating player exactly **one normal (standard) card**. An opening card cannot be a special, blank, Rainbow Ace, or transformed special. This applies to the first round and every later round, including Fun games. The method for constructing the remaining deck with persistent zones is still open.
- **Design preference:** do not add a bunch of extra points. Favor effects that change decisions, risk, ownership, or the existing hand bonuses. This is not a change to Classic scoring or a blanket rejection of previously recorded cards; point-awarding candidates need explicit reconsideration before shortlisting.
- **Added to the candidate list:** Daily Double, revised Ransom, Ricochet, persistent Booby Trap, Musical Chairs, Last Laugh, and revised Chicken. Their core effects below record the user's selections; remaining interactions are unresolved.
- **Rejected assistant pitches:** Double Dog Dare (#3), Split Decision (#4), Counterfeit (#8), and the original point-awarding Chicken (#10). Revised Chicken replaces that original version.
- **Not selected:** Bounty (#7) received no decision and is not added to the card catalog. Do not interpret silence as acceptance or rejection.

## Existing game and constraints

Reviewed the root [game concept](idea.md), [platform notes](react-native-plan.md), and [deployment notes](_DEPLOY.md); the frontend [README](hoq-fe/README.md), [MVP plan](hoq-fe/mvp-plan.md), and [style notes](hoq-fe/style-note.md); and the backend [README](hoq-be/README.md) and [plan](hoq-be/plan.md). Checked the relevant engine, session, protocol, bot, and UI source against those documents. Older planning text describes some now-completed work as future work; current code and READMEs establish the baseline below.

- Each round starts with one standard card per player and a fresh shared deck. Hit draws; a duplicate rank immediately busts for zero. Quit banks the hand.
- Each card scores 1; a flush adds 3, a straight adds 3, and seven cards add 5. Each category applies once and categories stack. Seven surviving cards automatically bank. An empty-deck Hit banks the current hand.
- The target is checked after everyone finishes the round. Highest qualifying totals win; ties share victory. The starting seat rotates.
- Timed turns are 10 or 30 seconds; expiry chooses Hit. Unlimited turns have no deadline.
- Hands and remaining deck inventory are visible; future draw order is not. Card counting is intentional.
- Solo and the backend already run the same pure engine and bot policy from `hoq-fe/src/game`. Online clients submit commands and render authoritative snapshots.

These are the current Classic rules, not settled rules for specials. In particular, protection for finished players and automatic banking at seven need a common decision before implementing special effects.

## Decisions to settle

This table records initial design suggestions, not final defaults. Settled rules above take precedence; the expanded shared decisions below identify what remains unresolved. Cards accepted into the candidate list are not commitments to implement.

| Decision | Recommended starting rule | Alternative / tradeoff |
| --- | --- | --- |
| How a special enters play | Opening hands are settled: exactly one normal card per player. Mixing specials into the remaining draw pile is still a proposal. | A separate reward deck changes acquisition and adds another interaction. |
| When it executes | Initial suggestion: immediately when drawn; choose required targets now. | Held cards and later activation are now explicitly in scope for exploration; timing remains undecided. |
| Does it replace the Hit? | Yes. Resolve the special, then end the turn; no replacement standard draw. | Drawing a replacement adds risk but introduces special chains. |
| Does it count in the hand? | Initial suggestion for action cards: no rank, suit, point, or seven-card progress; discard after resolution. | Blank, Rainbow Ace, and equation cards need scoring-card behavior. Set shared traits rather than assuming every special is disposable. |
| Must it be used? | Yes when a legal choice exists; otherwise discard with no effect. | Allowing a voluntary pass makes harmful or inconvenient effects optional. |
| Who can be attacked? | Other players still playing this round, including bot-controlled seats. | Attacking quit players would undermine banking and require revising totals/history. |
| Can you give/discard your last card? | No; keep at least one standard card. | Empty hands could be supported, but need explicit UI and scoring expectations. |
| Choice timer | A fresh 10/30-second choice window matching the match setting; unlimited stays unlimited. Expiry uses a deterministic legal choice. | Sharing the remaining Hit timer can leave almost no time to choose. |
| Meaning of “blinded for the rest of the turn” | Blind immediately through the end of the **target's next personal turn**, including any special choice in that turn. | Ending on the attacker's turn would usually expire before the victim makes a decision. A whole round is much stronger. |
| What Blindfold hides | All card faces, score values/previews, and scoreboard/deck inventory for the affected viewer. | Keeping historical scores visible is a milder variant. |
| Enabled by default | Keep Classic available; opt into an experimental Fun preset. | Making specials mandatory changes the current game for everyone. |
| Initial card mix | No preset selected; the earlier five-type/eight-copy suggestion is superseded. | Shortlist first, then select counts and tune through playtesting. |

### Expanded shared decisions — awaiting the user's decision

Decide these centrally for the ruleset. A card can declare a deliberate exception later, but should not invent its own target eligibility, bust timing, or scoring interpretation accidentally. No option in this table is selected.

| Shared factor | Options / questions to settle once | Examples affected |
| --- | --- | --- |
| Participation and targeting | Can playing, quit, auto-banked, busted, or waiting players be targeted, contribute cards, or use held cards? Are self-targets allowed by default or only explicitly? Keep these statuses distinct; “out” is ambiguous. | Draw Three explicitly permits self; stealing says any other player; WAR says all players. |
| Banked score protection | If a finished hand changes, is its banked score locked, recalculated, or can that player re-enter? Can a busted player ever recover points? When is history final? | Theft, forced draws, WAR, end-of-round attacks. |
| Seven cards | Keep immediate auto-bank, permit a forced effect to finish before banking, or allow play beyond seven? Is seven a bonus threshold or a hard cap, and can its bonus repeat? | Draw Three, WAR penalty, pot collection, blank cards. |
| Sequential versus atomic effects | Resolve a multi-draw one card at a time or as a batch? Stop after bust/bank or finish the assigned count? When do reaction windows occur? | Draw Three, Daily Double, WAR penalty, pot collection, Chicken. |
| Nested specials | When forced draws reveal specials, do those count toward the draw count, resolve immediately, queue for later, or get replaced? Who makes each choice, and what bounds chains? | Draw Three, pot contents, future forced-draw cards. |
| Last-card and empty-hand rules | Can giving, stealing, stashing, or contributing leave zero cards? What does an empty hand score and can it Quit? What happens when a required contributor has no legal card? | Pocket, pot deposit, theft, WAR, Hot Potato. |
| Card traits | Independently define rank (including no rank), suits (one or several), base point value, hand-size contribution, duplicate-rank behavior, and straight/flush eligibility. Does one all-suit card count toward every suit's tally, while remaining one physical card? | Suit blanks, WAR reward, Rainbow Ace, equation card. |
| Activation and ownership | On draw, at start/end of own turn, before/after Hit, or in response to another effect? How many held cards and activations? Does activation replace Hit/Quit? Can recipients refuse gifted action cards? | Pocket, optional roulette targeting, future held cards. |
| Persistence and zones | Which zones/effects survive a turn, round, bust, leave, or new match? Are they public? Pot and Booby Trap explicitly carry across rounds; match resets and owner departures remain to settle. | Pot, Pocket, held action cards, Booby Trap. |
| Deck conservation across rounds | Do persistent cards stay excluded from the fresh round deck, or does each round create new instances? How do inventory counts represent either policy? Never duplicate an instance into both pot/pocket and deck. | Pot and any round-persistent Pocket. |
| Information and knowledge | Who sees a peek, pocket, pot, or committed choice? Can the viewer reopen it? Does blindness override private peeks? How long is stored knowledge shown after draws, transfers, or reshuffles? | Forecast, Pocket, WAR, Blindfold. |
| Random outcomes | Authority chooses once, records the result, and retries/reconnects reuse it. Decide distributions, who sees them, and whether blind state affects the reveal. Wheel animation never determines outcomes. | Even/Odd, random WAR penalties, shuffled Forecast display. |
| Simultaneous decisions | Secret commitments then reveal, or visible sequential choices? Can selections change before locking? What happens on ties, no submission, disconnect, or no legal card? | WAR and future group decisions. |
| Effect priority and stacking | Define precedence among protections, redirects, rank/suit changes, bust detection, banking, and expiry; define repeated modifiers. | Roulette curse versus bust protection, Tailor versus all-suit cards. |
| Exhaustion and no-op outcomes | Draw fewer if insufficient cards, reshuffle a defined zone, or end resolution? What does collecting an empty pot do? Do unusable effects consume an action? | Draw Three, Forecast with fewer than X cards, pot collector. |
| Round/match completion | Do queued effects, reactions, group submissions, and forced draws finish before declaring a round/winner? What happens to unused held cards and the pot at match end? | WAR, attacks on the last player, pot persistence. |
| Opening deals and existing effects | One normal opening card is guaranteed. Does an existing Booby Trap trigger on that automatic deal or only on Hits/effect draws? If triggered, when do its extra draws happen relative to completing everyone's opening deal? | Persistent Booby Trap; future persistent draw modifiers. |
| Draw modifiers and reactions | Does Daily Double affect only a chosen Hit or also forced draws? How do multiple copies combine? Can Ricochet redirect a redirected effect, and can Last Laugh cause another Last Laugh? Bound chains and define a common response order. | Daily Double, Draw Three, Chicken, Ricochet, Last Laugh, Booby Trap. |
| Timers and automation | One effect deadline, a deadline per choice, or the ordinary turn timer? Default selections for bots/timeouts must follow the same visibility and eligibility rules. | Equation input, Even/Odd, WAR, Pocket retrieval. |

Use the eventual decisions to build common eligibility, card evaluation, effect ordering, and zone-lifecycle helpers. Keep proposed card details below conditional on those decisions.

## One common execution lifecycle

Initial path for a simple on-draw action card: **draw -> identify definition -> collect a legal choice if needed -> apply effects -> settle affected hands -> finish turn**. The numbered flow below is the original narrow proposal. Held-card activation, scoring-card transformation, multiple participants, and persistence require the extensions described after the new candidates; they do not automatically discard their source or finish the active turn.

1. Validate the command against the authority's current actor, round, turn, and decision step. The authority is the local session in Solo and the backend in multiplayer.
2. Consume exactly one card from the authoritative deck. Standard draws continue through standard rules. A special leaves the deck and occupies a resolving zone rather than the scoring hand.
3. Look up its trusted definition. Generate legal choices from the current state. If none exist, emit a no-effect result and discard it. An automatic effect needs no choice panel.
4. For an interactive effect, store one serializable pending choice. Keep the same active player and turn ID while this choice is open. Hit and Quit are unavailable; other players wait.
5. Accept one complete selection, validate it again, and resolve it atomically. Changing selections in the UI does not mutate the game. Dismissing a panel does not cancel the effect or pause its timer.
6. Apply the selected effect's operations as one transaction. Re-evaluate all affected active hands, not just the drawing player's hand. Resolve duplicate-rank busts before seven-card banking. Recompute unbanked score previews from the resulting state.
7. Discard the special, clear the pending choice, expire effects due at this turn boundary, and advance the turn once. Skip anyone who just busted or banked. If everyone is finished, record the round once and check victory after all effects and scoring have settled.

The original illustrative set needs no reactions, stored cards, or recursive extra draws. The broader candidate pool may need these. Choose cards and shared timing rules before deciding which mechanisms to implement. A small typed effect system is the aim; avoid a general scripting language.

### Shared edge rules

Except for the now-settled normal opening card, these are defaults from the original immediate-effect proposal, **not decisions for the expanded pool**. Finished-player protection, last-card restrictions, and round cleanup remain open; persistent pot contents and Booby Trap explicitly fall outside blanket round cleanup.

- **Opening deal — settled outcome:** automatically deal exactly one normal card to each participant every round; never deal a special as their opening card. Proposed construction: deal from eligible normal cards first, then mix specials into the remaining draw pile. Reconcile eligible cards with persistent zones before choosing the algorithm; validate capacity against normal opening cards, not total mixed-deck size. Whether an existing trap reacts to this normal deal remains open. With specials disabled, preserve existing setup and shuffle behavior.
- **No legal targets:** consume the special, report why it had no effect, and end the turn. No substitute draw or retry. A UI selection that became stale is rejected/resynced, not silently converted to a no-effect use.
- **Already finished players:** cannot give, receive, steal, recolor, or be attacked. Disconnection alone does not make a playing seat ineligible; its bot owns decisions.
- **Transfers:** move the existing card instance; do not copy or draw it. A transferred card does not trigger an on-draw special. Card-bound suit changes travel with it; player-bound point modifiers do not.
- **Deck exhaustion:** if the last card is a special, resolve it normally. Do not bank its drawer solely because the deck is now empty. The next empty-deck Hit banks as usual.
- **Round cleanup:** clear effects/zones according to their explicit lifecycle. Daily Double expires at round end; pot contents and armed Booby Traps carry over. The earlier blanket reset is unsuitable for the expanded pool. Other lifecycle and deck-rebuilding details remain open.
- **No-effect and rejected command differ:** a valid drawn card with no targets consumes the turn; an invalid request consumes nothing.

## Starter catalog

All entries are unimplemented. Historical illustrative set: **Hot Potato x2, Tailor x2, Blindfold x1, Payday x2, Trim x1**. This is superseded as a recommendation, not a selected shortlist. In particular, Payday's extra points require reconsideration under the user's preference. The old counts and priorities below are retained as draft history only; choose a new mix after shortlisting. Detailed behaviors remain initial proposals subject to the shared decisions above.

| ID / card | Intent | Effect and selection | Reusable pieces | Priority |
| --- | --- | --- | --- | --- |
| `hot-potato` / Hot Potato | User example: sabotage by giving a card | Choose one standard card in your hand and another active player. Move it to them; a duplicate rank busts them. Keep at least one card yourself. | Own-card + player selection; transfer; common hand settlement | First set, 2 copies |
| `tailor` / Tailor | User example: help complete a flush | Choose one of your standard cards and a different suit. Its effective suit changes for this round. Rank is unchanged. | Own-card + suit selection; card modifier; common scoring | First set, 2 copies |
| `blindfold` / Blindfold | User example: deny information | Choose another active player. They see neutral `?` cards and lose score/deck information immediately through their next personal turn. | Player selection; timed player status; viewer projection | First set, 1 copy |
| `payday` / Payday | Higher scoring without changing ranks | Automatically add +3 to your eventual banked score this round. Lose it if you bust. Multiple copies add together. | Player score modifier; common banking | First set, 2 copies |
| `trim` / Trim | Reduce risk before later Hits | Choose and discard one of your standard cards, keeping at least one. Recompute bonuses; no replacement draw. | Own-card selection; discard; common scoring | First set, 1 copy |

### Hot Potato: exact proposed behavior

The sender needs at least two standard cards and another active recipient. Quit/busted/waiting seats are excluded. Choose card and recipient in one panel and confirm once. Passing a 7 to someone already holding a 7 busts the recipient immediately; the sender remains active with one fewer card. If the recipient instead reaches seven distinct ranks, they auto-bank, including their own score modifiers. This can benefit the recipient, so targeting matters.

The sender's potential flush, straight, and points are recalculated after removal. A transfer never changes either player's already-banked history. The recipient's out-of-turn bust/bank must not accidentally move the active cursor or increment the turn twice.

### Tailor: exact proposed behavior

Select any own standard card and one of the other three suits. Keep the original rank, base suit, and identity; store an effective-suit override. Scoring and visible card fronts use the effective suit. A later Tailor on that card replaces its previous override. The override expires at round end and travels with the card if transferred.

Two physical cards can now have the same visible rank and suit while remaining different instances. Never derive identity from the displayed face. Tailor does not edit the inventory of undrawn cards or permit duplicate ranks in a surviving hand.

### Blindfold: exact proposed behavior

This affects **what the target sees**, not how the target's hand looks to everyone else. The target's own hand, opponent inspection, card previews, and dealing animations use the same neutral `?` face, with no suit-color clue. Disable the combined scoreboard/deck control and close any already-open score/deck panel. Hide inline totals, current-hand points, bonus breakdowns, and banked-score badges too; leave player names, hand counts, playing/quit/bust status, active turn, timer, and total deck count visible.

Example: A blinds B. B immediately loses visibility while other players act, then takes their next Hit/Quit turn blind. If B draws an interactive special, B resolves that choice blind too. Visibility returns after B's entire turn resolves. If B quits, busts, or auto-banks before that boundary, clear blindness when B leaves active play; round end always clears it. Repeated Blindfolds before B acts do not accumulate extra turns. Track the target's turn boundary explicitly, not an assumed global `turnId + 1`.

Blind players can still choose their cards using neutral positions/opaque handles and choose named players/suits. The prompt may explain the required action, but must not reveal the drawn card's artwork or other hidden faces. Legal-choice metadata and errors must not disclose ranks or computed points. A blinded bot must receive the same restricted information and use a fallback policy that does not inspect hidden ranks or deck inventory.

Multiplayer needs recipient-specific snapshots and event redaction, not only a React overlay. Existing clients have already seen earlier public cards; blindness cannot erase human memory, screenshots, or previously received information. The supported behavior is to remove current UI information and stop sending new restricted information for the duration.

### Payday and Trim: exact proposed behavior

Payday is a player-bound round modifier, not a scoring card. Proposed score order: standard card points and existing bonuses, then additive special bonuses; bust overrides the entire result to zero. For example, five cards with a flush and one Payday bank 5 + 3 + 3 = 11. Award the modifier only on banking, including automatic or empty-deck banking. Store the resulting score breakdown so UI previews and final totals agree.

Trim discards one selected own card when at least two are held. It cannot rescue a hand after an ordinary duplicate-rank draw has already busted it. Discarded cards remain out of the deck for the round. Removing a card may lose a straight or flush as well as reduce duplicate risk.

## Further candidates

These earlier assistant suggestions remain unselected. Point-boosting ideas such as Double Down, Flush Fever, and Cash Out are deprioritized under the user's preference, not silently approved or deleted. Pickpocket overlaps the user's later theft idea, and Forced Hit overlaps Draw Three; treat each pair as variants of one mechanic rather than separate implementation commitments.

| ID / card | Proposed effect | New rule or implementation issue |
| --- | --- | --- |
| `pickpocket` / Pickpocket | Steal one chosen standard card from another active player who has at least two. Your new hand can bust or auto-bank. | Reuses transfer; needs opponent-card picker and blind-safe selection. |
| `switcheroo` / Switcheroo | Exchange one own card with one card from another active player. | Atomic exchange; settle both resulting hands together, with either/both able to bust. |
| `double-down` / Double Down | Double your eventual round score; bust still scores zero. | Specify multiplier order, interaction with Payday, and whether repeated copies stack. Suggested starting cap: one x2. |
| `flush-fever` / Flush Fever | Your flush bonus becomes +6 instead of +3 this round. | Named bonus override; repeated copies should not increase it again. |
| `loaded-die` / Loaded Die | Change one own card's rank to a selected rank; duplicates can bust you. | Rank modifier and picker; define ace handling and blind-safe options. |
| `shield` / Shield | Ignore the next hostile special targeting you this round. | Define hostile effects, when the shield is consumed, and whether transfers are cancelled before removal. Automatic protection, not a reaction prompt. |
| `second-chance` / Second Chance | On your next duplicate standard draw, discard that drawn card instead of busting. | A pre-bust interception hook; decide whether it protects against Hot Potato too. |
| `forced-hit` / Forced Hit | Make another active player draw immediately. | Nested draws, special ownership/choices, exhaustion, and timer behavior. Defer until a bounded resolution queue is designed. |
| `u-turn` / U-Turn | Reverse the direction of future turns. | Direction in state and a shared next-player selector; define two-player behavior. |
| `cash-out` / Cash Out | Immediately bank your hand with +2 points. | Reuses score modifier + bank operation; especially safe when drawn, so balance carefully. |

## Additional user candidates — recorded before shortlisting

These preserve the user's concepts and uncertainty. Working names are placeholders. No quantities, priority, global eligibility restrictions, or implementation commitments are assigned. The pot idea contains two related cards; the blank-suit idea is a family of four.

### 1. Draw Three (`draw-three`)

Choose a player, **including yourself**, who immediately draws three cards with no option to Quit between them. This can be sabotage or a calculated attempt to score higher.

To flesh out: apply the common rules for bust/bank during a sequence, passing seven, drawing specials, and exhaustion. Decide whether the effect stops when the target busts or completes all three draws. These must not be answered separately from other forced multi-card effects. Related earlier idea: Forced Hit.

### 2. Steal a Card (`steal-card`)

Take a card from **any other player** into your hand. This promotes the earlier Pickpocket mechanic into the user candidate pool without accepting its earlier active-player/keep-one restrictions.

To flesh out: choose a visible card versus take a random card; eligibility of quit/busted players; whether the victim can be left empty; and the usual bust/bank check on receipt. Keep one selected version rather than implementing duplicate theft cards accidentally.

### 3. Equation (`equation`)

Receive a math expression with a variable, enter a value for that variable, and transform the card into the number the expression evaluates to. This is choosing an input to create a useful result, not necessarily a right/wrong quiz.

Illustrative expression only: `2x + 1`; entering `x = 3` produces rank 7. Decide allowed inputs, allowed outputs (for example ranks 1–13), suit, whether A/J/Q/K map to 1/11/12/13, fractional/negative/out-of-range results, timeouts, and whether the input can deliberately cause a bust. Also decide how much arithmetic challenge is enjoyable under a turn timer and how bots select inputs fairly.

If selected, use a bounded set of typed expression templates and an authority-side evaluator. Never evaluate arbitrary user-supplied code. Reuse numeric input, transformation, and common card-trait/scoring rules.

### 4. Pot pair: Deposit / Collect (`pot-deposit`, `pot-collect`)

Deposit makes you put one card from your hand into a shared pot. A separate Collect card makes you draw **whatever is in the pot**. **The pot persists between rounds** in this concept, so it can become a tempting prize or a delayed trap. Do not silently reduce collection to one card.

To flesh out: whether contents are visible; who chooses the deposited card; empty-pot behavior; what “draw” means for special cards; collection order; bust/bank/hand-limit handling; whether collection moves everything at once or stops after a terminal result; and what happens to any uncollected contents. Decide whether transformed suits/ranks persist while stored. Match-end cleanup and interaction with fresh standard decks need the shared persistence/identity policy above.

If selected, model a match-level zone and shared transfer operations rather than putting the pot on a player or clearing it in ordinary round cleanup. Inventory must account for cards retained between rounds.

### 5. Forecast (`forecast`)

See the next **X** cards in a random display order. The information reveals the upcoming group without telling you the exact sequence.

To flesh out: choose X; private or public reveal; reveal duration; fewer than X cards remaining; how specials appear; and blindness interaction. Clarify that randomizing the preview does not imply shuffling the actual deck. If selected, sample the actual next X identities, randomize only the authorized preview, and deliver it through viewer-specific projections. Do not sort or expose original draw-position metadata in that preview.

### 6. Even or Odd (`even-or-odd`)

Choose even or odd, then generate a number/spin a wheel for an intended **50/50** outcome. Winning turns all your cards into the same suit, aiming for a flush. Losing turns all your cards into the same rank, aiming to bust the hand. Possible variant: use it yourself or give it to another player who must use it.

To flesh out: who chooses parity when gifted; whether gifting is optional; who chooses the resulting suit/rank; duration; which cards transform; and interaction with blanks/rainbow cards. Under current rules, same-suit cards need at least five cards for a flush, and same-rank cards need at least two rank-bearing cards for a duplicate bust. Decide whether these are normal transformations subject to thresholds or effects that directly award a flush/force a bust regardless of hand size. A 50/50 wheel outcome does not mean equal strategic value for the two outcomes.

If selected, the authority resolves an unbiased outcome once after parity is locked, then applies a batch transformation through common settlement. The wheel only illustrates the recorded result.

### 7. Pocket (`pocket`)

Stash one card currently in your hand into a pocket where it no longer counts as a hand card. On each turn, choose whether to draw/retrieve that card. If never retrieved, it contributes no final score. Removing its rank from the hand could reduce bust risk.

To flesh out: retrieval instead of the ordinary Hit or in addition to it; activation/retrieval before versus after a draw; pocket capacity and reuse; visibility; last-card rules; retrieval causing bust/bank; and persistence after Quit, bust, or round end. Decide whether an immediate bust allows any pocket response or whether stashing must happen beforehand. “Each turn” must be defined as the owner's turn or any player's turn.

If selected, the pocket is an explicit owned zone with legal store/retrieve commands. A stashed card must not remain in hand-size, scoring, duplicate detection, or undrawn inventory calculations.

### 8. WAR (`war`)

All players submit one card. The highest rank wins and receives a **blank card with no rank and all suits**. The lowest player receives the contributed cards, capped at **three randomly selected cards when more than three players participate**, potentially busting them.

To flesh out: whether “all” includes quit/busted players; hidden simultaneous submissions versus sequential reveal; ace high/low; rankless submissions; ties for highest/lowest; and players unable to contribute. Determine where contributed cards not awarded to the loser go. Clarify whether the loser's submitted card is part of their award (the current concept includes it in the contribution pool), how penalty receipt settles, and how the winner's reward counts toward points/hand size/bonuses. Existing duplicate ranks across different players make ties a normal case.

If selected, keep all contributions locked in a shared contest zone until submissions complete, then resolve rewards and penalties once. Reuse common group-choice handling, random selection, transfer, generated-card identity, and settlement. A returning/disconnected player must not restart the contest or submit twice.

### 9. Suit blanks (`blank-spades`, `blank-clubs`, `blank-hearts`, `blank-diamonds`)

A blank card for each suit. Intended interpretation to confirm: a card with that suit but no rank, distinct from a wildcard whose rank the player chooses.

To flesh out: whether it is worth one point, counts toward hand size/seven, and helps a flush; whether it is ignored by duplicate-rank checks and straights; and how it behaves in WAR, rank transformations, or other card selection. Multiple no-rank cards must not accidentally bust merely because their rank field has the same empty value.

### 10. Rainbow Ace (`rainbow-ace`)

An Ace that is all suits. Unlike the WAR reward, it has a rank.

To flesh out: ordinary Ace duplicate behavior, ace-low/high straights, simultaneous membership in all suit counts versus choosing one suit, suit-change effects, and scoring/hand-size contribution. Do not assume “all suits” alone creates a flush: the shared suit-count rule should decide how it supports the rest of a hand.

## Additional selected concepts and revisions

These concepts are **accepted for the candidate list**, not implementation-ready. No copy counts or release priorities are chosen. Use the global decisions for eligibility, passing seven, bust/bank timing, and card ownership rather than inventing exceptions below.

### Daily Double (`daily-double`)

Select a player. **For the rest of the round, each time they choose Hit, they must draw two cards instead of one.** They can still choose Quit before committing to a Hit; choosing Hit commits to the two-card draw, without a Quit between its cards.

Remaining decisions: self-target eligibility; stopping after a first-card bust/bank; seven-card handling; drawn specials; exhaustion; repeated Daily Doubles; and whether forced draws are affected. The stated scope is a **chosen Hit**, not automatically doubling every draw event. Resolve its interaction with Chicken through the common draw policy. Store it as a player effect with round-end expiry and display “Hit draws 2” beside the affected player's action/status.

### Ransom (`ransom`)

Choose another player and **a specific card of your choice from their hand**. They must either give you that selected card or immediately Hit. The attacker chooses which card is demanded; the target chooses whether to surrender it or take the risk.

Remaining decisions: eligibility of finished players, last-card protection, target response timeout, attacker receipt causing bust/bank, and whether this induced Hit uses Daily Double. Snapshot the demanded card reference, validate it again at resolution, and do not silently substitute a different card if another effect moved it. No bonus points are awarded.

### Ricochet (`ricochet`)

Hold this card. When another player targets you with a special, redirect that special to another player, **including its attacker**.

Remaining decisions: reaction timing/deadline, what counts as a redirectable targeted special, legal replacement targets, repeated redirects, and handling card-specific selections when the target changes. For example, Ransom's chosen card belongs to the original target: decide who reselects a card on redirection rather than reusing an invalid selection. Do not apply then undo the attack; resolve any redirect before its effects commit.

### Booby Trap (`booby-trap`)

Hold this card and play it to secretly name a rank. The first opponent who draws that rank must immediately draw another card; the trap reveals when triggered. **There is no “until your next turn” expiry, and an armed trap can carry over between rounds.** Preserve the original one-trigger concept; the accepted change extends its duration, not its number of charges.

Remaining decisions: whether automatic normal opening deals and forced draws trigger it; what counts as a rank match after transformations; behavior if the triggering draw already busts/banks; multiple traps on the same rank; owner Quit/bust/leave; and match-end cleanup. Persistence of an unplayed held copy is a separate shared held-card decision. Keep the hidden chosen rank in authority state, carry armed effects across round reset, and show only permitted trap information to other viewers.

### Musical Chairs (`musical-chairs`)

Everyone selects one card from their hand and locks it in. **The player who draws Musical Chairs chooses whether those cards move left or right**, then the cards move together one seat in that direction. Each participant gives one card and receives one.

The direction is the drawer's choice, not a vote or random result. Remaining decisions: whether direction is chosen before or after card commitments are revealed; who participates, including finished/empty-handed seats; whether left/right skips nonparticipants; and simultaneous bust/bank settlement. Use an atomic cyclic transfer so an early elimination cannot change where later cards go.

### Last Laugh (`last-laugh`)

Hold this card. When you bust, give the card that caused your bust to another player. **You still score zero**, but the recipient may bust too.

Remaining decisions: targeting eligibility, response timing, whether it triggers from received cards as well as ordinary draws, and what to do when a batch rank transformation causes a bust without one identifiable busting card. Define the response window before finalizing the round so the last player's bust cannot skip an available Last Laugh. Use shared reaction-chain limits if the recipient can answer with another copy.

### Chicken — revised (`chicken`)

Choose another player. You both keep taking Hit/Quit decisions in a contest **until someone busts or quits**. If both Quit on the same contest step, there is **no penalty**. If one Quits first and the other continues without busting on that step, the survivor takes **a card of their choice from the quitter's hand**. There are **no bonus points**. This replaces the original one-step, point-awarding pitch.

Working interpretation to confirm: “same round” here means the same decision step within Chicken, not the whole game round. Each step needs a way to compare both choices without giving the second chooser advance knowledge; simultaneous locked Hit/Quit choices are a proposed mechanism, not yet a decided UI rule. Both Hit means resolve their draws and repeat if neither has finished. Both Quit means stop with no theft. Quit versus Hit means resolve the Hit first; survival earns the theft, bust means no theft.

Remaining decisions: whether quitting Chicken also banks/leaves the game round or only exits the contest; ordering both players' draws from one deck; what happens on one/both busts or auto-banking at seven; Daily Double and drawn-special interactions; whose normal turn resumes; and theft settlement/score protection. The effect explicitly takes a card from the Chicken quitter, so reconcile that with any general protection for quit players rather than silently prohibiting the defining penalty. If quitting banks the hand, decide whether banking occurs before or after theft and how its score is finalized. No extra penalty/reward is specified for a bust-only ending.

### Architecture implications to keep open while selecting cards

Keep the reusable engine/adapter separation, but expand the earlier contracts only as accepted mechanics require:

- **Separate action cards from scoring traits.** A disposable special, a held ability, and a rank-bearing or rankless scoring card are different concepts. Model rank, suit membership, score value, and hand-size contribution explicitly. Do not force Rainbow Ace or blanks into the earlier rankless disposable `SpecialCard` definition.
- **Resolve effects under an explicit context.** Track source, controller, target, queued operations, current decision, and continuation. A forced draw may require a target's choice while somebody else remains the turn owner. Advance once when the owning resolution finishes under the eventual timing policy.
- **Support group choices only if needed.** WAR requires choices keyed by participant with commit/reveal semantics and deadlines. The earlier single-actor `PendingChoice` is not sufficient by itself.
- **Reuse contests and reaction windows.** Musical Chairs, WAR, and Chicken need participant choices and continuation rules. Ricochet and Last Laugh need an explicit response window; Daily Double changes the common Hit draw count. Use shared mechanisms once the timing decisions are settled, not independent modal/timer implementations for each card.
- **Give zones a declared lifecycle.** Hand, draw pile, discard, pot, pocket, held actions, resolving source, and contest contributions need explicit ownership and reset rules. Generated rewards require unique identities; transformed cards retain theirs. Conservation includes generated/retired cards rather than assuming a fixed initial count forever.
- **Record authority-chosen randomness and private knowledge.** Both Solo and multiplayer use the same pure effect logic with injected/recorded random inputs. Keep preview display order separate from deck order; do not broadcast private Forecast results or secret submissions.
- **Reuse input types.** Add numeric input, even/odd selection, and participant submissions alongside card/player/suit selectors. Payload validation, bot choices, reconnect state, and timeout behavior follow those same descriptors.

These are design considerations, not instructions to build a queue, persistent inventory, or reaction system now. Shortlist first, then choose the smallest common implementation that supports it.

## Shared frontend/backend architecture

The following sections preserve the initial implementation proposal for simple on-draw cards. Their concrete restrictions and acceptance cases are conditional on the eventual shortlist and shared decisions, not requirements already chosen by the user. Reconcile them with the candidate implications above before implementation.

### Keep one authority implementation

Keep the pure implementation in `hoq-fe/src/game` for now: the backend already imports it, and deployment already requires the sibling sources. A separate shared package can be extracted later if distribution requires it. Do not maintain a frontend copy and backend copy of card logic.

The current `Rules.resolveDraw(hand, drawn)` returns only a replacement hand plus bust/bank flags. That contract cannot represent opponent changes, an unresolved choice, or viewer restrictions. The engine also advances the turn immediately after each command. Extend those contracts deliberately; adding a few branches to the card renderer will not implement these mechanics.

### Definition registry and small effect primitives

Use a trusted registry keyed by stable `definitionId`. Each definition provides its ID/version, copy count or preset reference, display-text key, choice specification, legality logic, and a typed effect plan. Keep artwork/font references in a separate frontend presentation registry. No functions, JSX, or assets belong in saved state or WebSocket messages.

Start with a few reusable operations: `transferCard`, `discardCard`, `setCardSuit`, `addScoreModifier`, and `addPlayerStatus`. Draw, bank, bust, and round completion remain shared engine operations. A card composes these helpers; it never directly edits totals, advances the cursor, or sends a socket message. Use explicit parameter types rather than arbitrary state paths or executable client-supplied scripts.

Centralize legal-choice generation, validation, and timeout fallback. UI and bots consume those descriptors; the authority validates the full combination again. If a new card needs a new mechanic, add a tested primitive or explicit hook, then reuse it across definitions.

### State and command contracts to introduce

The following names describe proposed contracts, not existing APIs:

| Contract | Required information / ownership |
| --- | --- |
| `SpecialCard` | `id`, `kind: 'special'`, `definitionId`; no rank or suit. Mixed draw pile accepts standard and special instances; scoring hands contain standards. |
| Standard card modifiers | Base rank/suit remain intact; effective suit comes from a card-bound round override. |
| `PendingChoice` | Unique `choiceId`, source special ID/definition, actor seat, round, turn ID, schema/constraints. One pending choice at a time in the first set. |
| Turn step | Distinguish `awaiting-action` from `awaiting-choice` inside an active round; do not overload round/game phase. |
| Player effects | Stable effect ID, type, source, target, parameters, explicit expiry/stacking rule. Round score modifiers and blindness are separate typed variants. |
| Discard / resolving zones | Consumed specials and discarded standards; every physical card is in exactly one zone. |
| `GameView` / `CardView` | Recipient-safe projection, separate from internal `GameState`. Visible card or hidden opaque handle; restricted scores/inventory absent or explicitly unavailable, not invented zeros. |
| Structured events | Event ID, kind, actor/target seats, source/effect and permitted result data. Build player-facing text after visibility filtering. |

Commands form a discriminated union: normal `hit`/`quit`, plus `resolve-special` with `choiceId` and a complete typed selection. Carry round and turn ID on both. Use choice ID/step validation to reject a stale normal action even while its turn ID still matches. A Hot Potato selection contains only the selected card reference and target seat reference; a Tailor selection adds a suit. Clients never submit cards, effects, scores, or the authoritative actor.

Keep `GameSession.submit` as the UI entry point. Extend `player.action` payloads to carry the union and retain request IDs for retries. On the server derive the actor from the bound socket; all targets are public seat IDs. Local session validation must be equivalent. Keep runtime payload validation as well as TypeScript types. Add an explicit protocol/ruleset version check so incompatible clients cannot start or resume a Fun game with a standard-only renderer.

### Timers, retries, bots, and reconnects

- The engine has no clocks or timers. Sessions attach deadlines to the current decision key `(round, turnId, step, choiceId?)` and dispatch commands through the shared engine.
- An expired normal action still becomes Hit. An expired special choice resolves a canonical legal choice, **never another Hit**. Validate actor/decision identity before handling expiry so an invalid or stale request cannot trigger a current decision.
- On the proposed fresh choice window, discard the old action deadline and start one choice deadline. Changing selections, sync, repeated snapshots, and reconnection never reset it. Unlimited decisions retain no automatic timeout.
- Canonical fallback uses stable seat order, card order, and suit order, choosing the first legal complete selection. It must not optimize using information hidden from the actor. No legal selection means the standard no-effect path.
- Preserve request-ID deduplication: a retry of the same request cannot move a card or award points twice; changed payload under an old ID is rejected. Also enforce engine step/choice identity so a fresh request ID cannot replay a resolved effect. Client retries retain the original request ID and payload.
- Bot policy chooses among the same legal choices through the same command path. Supply a viewer-safe bot view; extend the current Hit/Quit-only bot interface. Random decisions use injected randomness for reproducible tests.
- Disconnect/leave during a choice hands that same pending choice to the replacement bot. Reconnect restores the latest choice and its existing deadline, or the resolved result if the bot/timeout already acted. Cancel stale bot callbacks using the session generation mechanism.

### Visibility is a shared projection

Introduce a pure `projectGameForViewer(state, viewerSeatId)` used by both local and backend sessions. Local authority state stays separate from the snapshot exposed to UI. Multiplayer projects separately for every recipient, including sync, join/resume, retry replies, and waiting members; replacing only the broadcast path is insufficient.

Standard card IDs currently encode the face (`spades-1`). Do not send those as hidden-card handles. Use opaque instance IDs/selection handles, and ensure no base fields, modifier metadata, event text, legal options, or accessibility labels reveal hidden rank/suit data. Deck views expose aggregate/sorted inventory when allowed, never the internal ordered deck. Blind views expose only the total deck count. Hide score-bearing fields in history and player data as well as the scoreboard component.

Replace cached visible snapshots when blindness starts; clear open inspections and transient card previews. Do not replay previously queued unredacted animations/events. Give events stable IDs for deduplication because sync/retries can repeat revisions. A reconnect receives current visibility and no unfiltered event backlog. Other viewers continue seeing public hands normally.

### Reusable presentation

Add one special-resolution panel driven by the pending choice descriptor, with reusable player, card, and suit selectors, a preview of the permitted selection, Confirm, and the authority's countdown. Show other players who is choosing without exposing restricted data. Keep hand inspection available during selection where allowed; it must not lose the pending choice. An invalid selection receives a readable error and fresh choices.

Extend the common card renderer for standard, special, hidden, and deck-back views. Hidden cards need neutral artwork and the accessibility label “Hidden card”; a suit-colored front with `?` still leaks information. Follow the existing pixel-art theme, wrapping hands, scrollable mobile layout, and bounded overlays. Use status badges with clear expiry text, such as “Blind until your next turn ends.”

Remove direct `standardRules.score(...)` calls from table/inspection UI in favor of the shared projected score breakdown. Display special additions alongside existing bonuses when permitted. Keep animations and selection state out of the authoritative engine; animation completion must never trigger gameplay advancement.

### Planned file responsibilities

| Existing area / proposed addition | Work when implementation is approved |
| --- | --- |
| `hoq-fe/src/game/types.ts` | Mixed card types, command union, pending choice/turn step, modifiers, structured events, view contracts. |
| `hoq-fe/src/game/engine.ts` | Choice continuation, atomic multi-player effects, shared settlement and exactly-once turn/round completion. |
| `hoq-fe/src/game/standardRules.ts` | Preserve Classic; factor standard scoring/bust helpers for effective faces and special score composition. |
| New `hoq-fe/src/game/specialCards.ts`, `effects.ts`, `visibility.ts` | Registry/choice definitions, reusable effect operations, recipient projection. Split further only as needed. |
| `hoq-fe/src/game/bots.ts`, `deckInventory.ts`, `setup.ts` | Choice policy and blind fallback, mixed inventory, presets and opening deal. |
| `hoq-fe/src/session/types.ts`, `localSession.ts`, `remoteSession.ts` | View snapshots, command union, decision deadlines, reconnect/choice restoration and request retries. |
| `hoq-be/src/protocol.ts`, `sessions.ts` | Runtime validation, ruleset negotiation/configuration, authoritative choice dispatch, per-recipient snapshots, bots and decision scheduling. |
| `hoq-fe/src/ui/components.tsx`, `GameTable.tsx`, `OpponentList.tsx`, `DeckInventory.tsx` | Reusable renderers/pickers, visibility handling, effect badges, shared score previews and mixed inventory. |
| `hoq-fe/App.tsx`, `src/ui/RuleControls.tsx`, `MultiplayerRoom.tsx` | Solo/host preset selection and shared lobby rule summary. Lock selected definitions/counts/version for a match. |
| Existing frontend/backend test suites and READMEs | Classic regression, effect coverage, adapter parity, protocol/settings documentation. |

## Implementation sequence and acceptance checks

1. **Shortlist and settle remaining shared rules:** retain the accepted one-normal-card opening rule; decide eligibility, seven-card handling, timing, persistence, and choice defaults. Candidate-list acceptance is not authorization to implement everything listed.
2. **Choose a representative accepted card for the common flow:** Hot Potato remains one possible starting point for targeting/transfer, not a fixed release commitment. Implement only the shared mechanisms the chosen shortlist needs across both adapters and bots.
3. **Add shortlisted variants:** reuse selectors, transformations, zones, draw modifiers, contests, and reaction windows as needed. Do not automatically implement Payday or other point boosts from the old sample preset.
4. **Complete information handling for selected cards:** Blindfold, Forecast, traps, and secret commitments need appropriate projection/redaction before enabling those mechanics.
5. **Playtest the selected mix:** tune definitions/counts without separate frontend/backend rule edits. Verify disabled specials retain Classic behavior.

Required behavioral coverage when implementing:

- Every participating player automatically receives exactly one normal opening card in the first and every subsequent round, even with special-rich decks or persistent zones. Apply any agreed opening-deal trap effects as a separate resolution under the eventual policy.
- If selected: Daily Double expires at round end; Booby Trap and pot state survive round changes; Ransom demands the attacker's chosen card; Musical Chairs follows the drawer's direction; Chicken's same-step double Quit has no penalty and its theft occurs only after the other player's surviving Hit. Exercise reactions before round completion and verify none of these mechanics introduce unspecified point bonuses.

- Transfer into a duplicate rank busts the recipient; a safe seventh card banks them; the sender loses any invalidated bonuses. Settling an out-of-turn recipient advances only once.
- Giving/discarding the last card, targeting finished/waiting seats, stale choices, malformed suit/card references, and forged actors are rejected without mutation. No-target draws are consumed normally.
- Suit override changes only effective suit, travels with transfers, never changes undrawn inventory, and resets next round. Bonuses remain once per category.
- Payday applies exactly once per resolved copy when banking and is lost on bust; previews, banked totals, round history, and winner checks agree.
- Hit/choice timeouts, unlimited decisions, late clicks, retries, disconnect/bot takeover, and reconnect race without double effects or deadline resets. A pending choice prevents round advancement.
- Blindfold lasts through the target's full next turn, handles early out-of-turn elimination and repeated applications, and never affects other viewers. Test raw snapshots/events, encoded IDs, cached views, accessibility labels, already-open panels, and blinded bot inputs.
- Empty deck, final-card special, last remaining active player, round cleanup, and fresh-game reset work without dangling pending effects or duplicated cards. Every initial physical card remains in exactly one zone.
- Deterministic Solo/backend scenarios produce equivalent authoritative results and equivalent views for each seat from identical decks, selections, and simulated decision timings. Cover sync and resume, not only initial broadcasts.
- Run appropriate engine/session tests, backend integration tests, frontend typecheck, and web/native bundle checks. Visually check selectors, hidden cards, and overlays on mobile and desktop; device runtime checks remain separate from successful bundles.

Record playtest observations: how often each selected card is drawn, has no legal use, causes a bust, changes banked points, or times out; round duration and perceived fairness at small and large tables. Measure early no-ops, forced-draw severity, persistent-trap buildup, and contest length. Prefer improving interactions over adding arbitrary point rewards.

## Decision log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-09-24 | Record the requested give-a-card, suit-change, and blindness concepts and propose a common shared-engine design. | Draft created; implementation not started. |
| 2026-09-24 | Record ten additional user concepts, including the two-card persistent pot mechanic, and expand the global decisions for targeting, hand limits, timing, traits, and persistence. | Idea collection only; no shortlist or shared rules selected. |
| 2026-09-24 | Automatically deal exactly one normal card to every participant at the start of every round. | Settled game rule; special-aware setup implementation remains future work. |
| 2026-09-24 | Add Daily Double, revised Ransom, Ricochet, cross-round Booby Trap, drawer-directed Musical Chairs, Last Laugh, and revised no-bonus Chicken. | Accepted into candidate list; details still to settle, no implementation requested. |
| 2026-09-24 | Reject Double Dog Dare, Split Decision, Counterfeit, and original point-awarding Chicken; prefer fewer extra-point mechanics. Bounty remains unselected. | Selection feedback recorded; old preset superseded as a recommendation. |

For each accepted card, retain its stable ID, exact effect, legal selections, timing/expiry, stacking, no-target/timeout behavior, deck count, score interactions, and acceptance cases here. Change the rule definition once and verify both execution modes against it.
