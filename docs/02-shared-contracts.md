# 02: Shared Contracts

The `shared/` package is the contract boundary between Expo client and Node server.

- Source files:
  - `shared/types.ts`
  - `shared/constants.ts`

## Why This Matters

Without shared contracts, client and server would drift in event payload shape and game-state fields. This folder prevents that by giving both sides one source of truth.

## Core Enums and Unions

## `PlayType`

Defined in `shared/types.ts`.

- Standard: `SR`, `LR`, `SP`, `LP`
- Specials: `TP`, `HM`, `FG`, `PT`, `TO`
- Conversion: `XP`, `2PT`

This is used everywhere:
- hand cards
- special-action virtual IDs
- bot strategy
- UI labels and recommendations

## `GamePhase`

Current phases:

- `LOBBY`
- `COIN_TOSS`
- `OFFENSE_SELECT`
- `DEFENSE_SELECT`
- `CONVERSION_OFFENSE_SELECT`
- `CONVERSION_DEFENSE_SELECT`
- `CONVERSION_RESOLUTION`
- `RESOLUTION`
- `GAME_OVER`

Important nuance: selection phases are where `PLAY_CARD` submissions are accepted.

## State Shapes

## `ServerGameState`

Authoritative state living in `GameEngine`:

- `roomId`
- `phase`
- `players.home` and `players.away` (`PlayerState`)
- `field` (`FieldState`)
- `pendingMove` (`offenseCardId?`, `defenseCardId?`)
- `conversion` (`ConversionState | null`)
- `lastPlay?` (`PlayResult`)

## `ClientGameState`

Sanitized view sent to each player:

- `phase`
- `myState` (full personal hand/specials)
- `opponentState` (limited info only: score/timeouts/deckCount/handCount)
- `field`
- `conversion`
- `lastPlay`
- `waitingForOpponent`

Key security design:
- Client never gets opponent hand card IDs.

## `PlayerState` vs `SpecialActionState`

`PlayerState` includes:

- hand
- deckCount
- score/timeouts/hailMaryCount
- `specialActions: SpecialActionState[]`

`SpecialActionState` exposes:

- virtual special `id` (for example `SPECIAL:home:FG`)
- `enabled`
- `remaining` (for trackable resources like HM/TP/TO)
- `reason` when disabled

This lets the UI render legal/illegal specials without hardcoding game rules.

## Field Model

`FieldState` includes:

- `possessionPlayerId`
- `ballOn` (`0..100` absolute coordinate)
- `down`, `toGo`
- quarter/clock
- overtime indicators
- `awaitingZeroSecondPlay`

Internal engine calculations may use offense-forward transformations, but the client only sees absolute `ballOn`.

## `PlayResult.flags` Contract

The `flags` object is heavily used by UI and tests.

Current flags include:

- `defPenalty`
- `zeroSecondPlay`
- `kickoffTouchback`
- `kickType` (`KICKOFF`, `PUNT`, `FIELD_GOAL`)
- `kickDistance`
- `returnYards`
- `kickResultSpot`
- `icedKicker`
- `conversionType` (`XP`, `2PT`)
- `conversionSuccess`
- `mandatoryTwoPoint`
- `otBucketReset`

This supports rich recap UX and structured assertions in tests.

## Socket Join Contract

`JoinGamePayload`:

- `roomId`
- optional `playerToken` for rejoin
- optional `requestedSeat`
- optional `quickPlayBot`
- optional `botDifficulty`

`JoinGameAck`:

- `roomId`
- `playerToken`
- assigned `seat`
- `rejoined`
- `mode` (`MULTIPLAYER` or `BOT`)

## Shared Constants

`shared/constants.ts` defines:

- standard deck blueprints (12-card baseline)
- special card descriptors (currently TP/HM as named specials)
- `GAME_CONFIG`:
  - hand size (env-overridable via `FB_HAND_SIZE`)
  - deck size
  - touchdown points

## Contract Evolution Rules (Recommended)

When adding fields:

1. Add to `shared/types.ts` first.
2. Update server emit path (`getSanitizedState`).
3. Update client parsing/usage.
4. Add or update tests validating new shape.

When changing semantics:

1. Update `FOOTBORED_RULES.md` and/or `ASSUMPTIONS.md`.
2. Update engine.
3. Update client display and tests that assert flags/messages.
