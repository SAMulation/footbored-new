# 03: Server Runtime and Engine

This is the deepest part of the project.

- Transport/session layer: `server/src/index.ts`
- Game logic engine: `server/src/engine.ts`

## Server Runtime (`server/src/index.ts`)

## Primary Responsibilities

- Accept socket connections.
- Manage rooms and player sessions.
- Handle join/rejoin and seat assignment.
- Forward validated move intents to `GameEngine`.
- Emit sanitized per-player state snapshots.
- Run bot turns in quick-play mode.

## Key Structures

## `RoomContext`

Per-room object containing:

- `game: GameEngine`
- `sessionsByToken: Map<string, PlayerSession>`
- `tokenBySeat: Map<'home' | 'away', token>`
- bot controls:
  - `botEnabled`
  - `botSeat`
  - `botDifficulty`

## `PlayerSession`

- `token`
- `seat`
- `socketId`
- `connected`
- `lastSeenAt`

Used for rejoin and stale-seat cleanup.

## Rejoin Flow

1. Client joins with `playerToken`.
2. Server finds existing session by token.
3. Server remaps seat to new socket ID.
4. Server emits `JOIN_GAME_ACK` with `rejoined: true`.

If disconnected too long:
- `cleanupStaleSessions` reclaims seat after `REJOIN_TTL_MS`.

## JOIN_GAME Logic

Behavior summary:

- Normalizes room code.
- Creates room if missing.
- Rejects invalid mode mixes:
  - quick play into non-empty non-bot room
  - non-bot join into bot room
- Chooses seat (`requestedSeat` if available; else first open seat).
- Starts game once both seats are occupied.
- Emits join ack + first state snapshot.
- Triggers bot turn loop if bot mode is active.

## PLAY_CARD Logic

Guardrails in server layer before engine call:

- room must exist
- phase must be selectable
- caller socket must map to home/away seat

Then:

1. `game.submitMove(side, cardId)`
2. If rejected -> emit `ERROR` + fresh personal state
3. If accepted but unresolved -> emit personal state
4. If resolved:
   - emit room state
   - call `advanceAfterResolution()`
   - emit room state again
   - run bot turn recursion if needed

## Sanitized State Strategy

`getSanitizedState(game, playerId)`:

- includes full `myState.hand`
- includes opponent only as aggregate counts
- computes `waitingForOpponent` from pending move slot visibility

This keeps game fair while preserving UX clarity.

## Bot Strategy Entry

`chooseBotSpecialType` + `chooseBotCard` + `maybeRunBotTurn`:

- Tactical heuristics based on down/to-go/ball position.
- Uses thresholds from `RULE_ASSUMPTIONS.balance.botDecision`.
- Supports conversion-specific logic (`XP` vs `2PT`).

## Game Engine (`server/src/engine.ts`)

## Primary Responsibilities

- Hold authoritative full game state.
- Validate move legality by phase/role/resource.
- Resolve all play outcomes deterministically.
- Apply ball movement, scoring, possession, downs/clock.
- Handle conversion and overtime phases.
- Provide structured `lastPlay` recap + flags.

## Core Internal State

The engine owns:

- two `Deck` instances (`deckHome`, `deckAway`)
- two `Hand` instances (`handHome`, `handAway`)
- coin-toss winners (opening + overtime)
- overtime possession counters
- TP cycle charges per side
- pending OT bucket reset marker

This internal state is projected into `ServerGameState` via `syncState()`.

## Determinism Model

The engine avoids runtime random sources for outcomes.

Pattern:

- Build seed from game context:
  - room ID
  - quarter/clock/down/toGo/ball
  - play types
  - etc.
- Convert hash -> deterministic index (`hashToIndex`).
- Select multiplier/outcome/roll from that index.

Benefits:

- reproducible test behavior
- replay-safe multiplayer progression
- easier regression debugging

## Move Submission API

Public methods:

- `startGame()`
- `submitMove(side, cardId)`
- `advanceAfterResolution()`
- `resetForRematch()`

`submitMove` routes by phase:

- conversion offense select -> choose XP/2PT
- conversion defense select -> 2PT standard-play submissions
- normal offense/defense select -> standard turn pipeline

## Normal Turn Resolution Pipeline

When both offense and defense cards are present:

1. Resolve submitted card IDs:
   - hand card or virtual special ID.
2. Consume special resources (HM, TP, TO) where appropriate.
3. Evaluate matchup (`evaluateMatchup`).
4. Return cards to hand when rules require it.
5. Apply yards/scoring/turnover logic.
6. Tick clock unless no-clock scenario.
7. Build `lastPlay` including flags and tagged message.
8. Refill hands and clear pending moves.
9. Transition to:
   - conversion flow, or
   - resolution phase, or
   - game over.

## Matchup Evaluation Branches

`evaluateMatchup` supports:

- offense timeout
- defense timeout (non-FG icing flow)
- punt
- field goal (including icing logic)
- TP vs TP
- offense TP
- defense TP penalties
- offense HM
- standard-vs-standard matrix flow
- fallback paths for mixed standard/special scenarios

## Standard Play Math

`resolveStandardPlay`:

1. Lookup quality from canonical matrix.
2. Select multiplier rank (`K/Q/J/10`) deterministically.
3. Select yard card (`0..10`) deterministically.
4. Apply multiplier + quality offset (from assumptions balance knobs).
5. Apply same-play branch override if triggered.

Same-play branch includes offense-favor and defense-favor subpaths with multiplier-specific behavior.

## Special Play Resolution

## Trick Play (TP)

- Outcome table of six codes.
- Weighted deterministically via assumption weights.
- Includes penalty and jackpot outcomes.

## Hail Mary (HM)

- Outcome table of six codes.
- Weighted deterministically via assumption weights.

## Punt (PT)

- Uses assumption min/max gross and return ranges.
- Handles touchback placement.
- Emits kick flags (`kickType`, `kickDistance`, etc.).

## Field Goal (FG)

- Distance-based success bands from assumptions.
- Defense timeout can apply icing penalty.
- On make:
  - add 3 points
  - kickoff in regulation
- On miss:
  - turnover with miss spot behavior from assumptions

## Conversion Flow

Triggered after touchdown (except OT shootout path).

States:

1. `CONVERSION_OFFENSE_SELECT`
2. either immediate XP resolution or:
3. `CONVERSION_DEFENSE_SELECT`
4. `CONVERSION_RESOLUTION`

Rules:

- OT3+ can require mandatory 2PT.
- XP success uses deterministic probability from assumptions.
- 2PT uses standard-play matchup and required yards threshold.

## Clock and Zero-Second Window

Clock tick behavior:

- standard play tick: 30 seconds
- no tick for timeout/no-clock outcomes
- at `0`, engine sets `awaitingZeroSecondPlay = true`
- next play may extend if defensive penalty or kickoff touchback flags indicate extension condition

`handleEndOfPeriod()`:

- quarters 1-3: advance quarter, reset clock
- after quarter 4:
  - if not tied -> `GAME_OVER`
  - if tied -> enter overtime

## Overtime Staging

Implemented college-style staging:

- OT1-2:
  - ball at 25
  - normal possession flow
- OT3-4:
  - mandatory 2PT after touchdowns
- OT5+:
  - 2PT shootout-style possessions
  - restrictions on HM/TP/PT/FG usage for offense

Resource refresh:

- two-period bucket policy (`OT1/3/5...`)
- resets HM/timeouts per assumptions
- emits one-time `otBucketReset` flag on first play in new bucket

## Special Actions API to Client

`getSpecialActionsForSide` computes action list each sync.

Rules encoded:

- offense-only vs defense-visible specials
- 4th-down gating for punts (except overtime handling)
- resource exhaustion reasons (`hm_exhausted`, `tp_exhausted`, etc.)
- conversion-only XP/2PT exposure in conversion phases

This is why UI can render legal chips without duplicating full game logic.

## Models (`server/src/models`)

## `Deck`

- builds 12-card standard deck from shared blueprints
- shuffles
- auto-resets when empty

## `Hand`

- manages refill to configured hand size
- `playCard`, `hasCard`, `returnCardToHand`

## Caveats to Know

- Room/game/session persistence is process memory only.
- Engine is large and multi-responsibility; refactoring into smaller domain modules would improve maintainability.
- Some football mechanics remain assumption-backed and intentionally documented as temporary.
