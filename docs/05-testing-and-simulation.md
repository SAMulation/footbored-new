# 05: Testing and Simulation

This project has stronger validation coverage than most prototypes at this stage.

## Command-Level Validation

## Full validation script

- `scripts/validate-all.sh`

Runs:

1. `server test` (with retry once)
2. `server build`
3. `server sim:socket` (with retry once)
4. `client lint`

## Manual playtest bootstrap

- `scripts/playtest-web.sh`
  - starts server and Expo web client together for quick manual sessions.

## Deterministic trace tool

- `scripts/trace-state.sh`
  - wraps `server run sim:trace`.

## Server Test Suite Coverage

All tests live under `server/src/__tests__/`.

## Engine correctness and flow

- `engine-flow.test.ts`
  - duplicate-submit rejection
  - away-side directional model
  - turnover-on-downs possession flip
  - quarter-end tick and resolution transitions

## Canonical data and deterministic behavior

- `canonical-rules.test.ts`
  - matrix and multiplier values
  - deterministic TP/HM outcomes by seed
  - rule-implementation guard behavior

## Open-rule resolution specifics

- `open-rules-resolution.test.ts`
  - rounding policy
  - same-play fallback behavior
  - TP penalty and TP-vs-TP handling
  - safety semantics and field reset

## Kicking and icing

- `kicking-flow.test.ts`
  - opening kickoff metadata
  - legal punts and touchback placement
  - kickoff touchback/return deterministic path checks
- `field-goal-icing.test.ts`
  - FG success band edges
  - icing timeout consumption
  - miss spot behavior
  - overtime FG icing behavior without kickoff transition

## Conversion and overtime

- `conversion-flow.test.ts`
  - touchdown conversion entry
  - XP and 2PT flow paths
  - OT3 mandatory 2PT enforcement
  - OT5 shootout behavior
- `overtime-clock.test.ts`
  - possession alternation across OT periods
  - shootout restrictions
  - bucket resource refresh cadence
  - zero-second extension behavior

## Presentation and telemetry flags

- `play-message-flags.test.ts`
  - recap content includes basis tags
  - iced-kicker tag
  - OT bucket reset tags

## Session lifecycle

- `reconnect-flow.test.ts`
  - initial token assignment
  - token-based rejoin
  - room-full behavior
  - stale-seat reclamation after TTL

## Bot logic

- `bot-decision.test.ts`
  - deterministic special selection heuristics
- `bot-quickplay.test.ts`
  - bot room setup
  - repeated bot/human resolution progression

## Config and assumptions integrity

- `assumptions-config.test.ts`
  - frozen config object shape
  - legal bounds for kick/FG/conversion/overtime/balance knobs

## Socket Regression Harness

File:
- `server/src/simulation/socket-regression.ts`

Scenarios:

1. Two-player full game progression
2. Conversion/flags scenario (forced touchdown setup)
3. Bot quick-play full game progression

Checks:

- valid phase transitions
- field invariants (ball bounds)
- conversion flags visibility
- game completion without stalling

## State Trace Harness

File:
- `server/src/simulation/state-trace.ts`

Purpose:

- deterministic markdown trace for debugging long-form state progression.

Key features:

- configurable seed / max steps / stall threshold / output path
- invariant checks per step
- action planning per phase (including conversion)
- terminal summaries:
  - game over
  - stall detection
  - invariant failure
  - move rejection

Output default:
- `server/.artifacts/traces/state-trace-<seed>-<timestamp>.md`

## Recommended Local Validation Loop

For logic changes:

1. `npm --prefix server run test`
2. `npm --prefix server run sim:socket`
3. `./scripts/trace-state.sh --seed <name> --max-steps 350`
4. `npm --prefix server run build`

For client-only UI changes:

1. `npm --prefix client run lint`
2. run local web client and do manual quick-play + two-tab smoke

For cross-cutting gameplay changes:

1. Run full `./scripts/validate-all.sh`
2. Capture one deterministic trace before/after for behavior diff.

## Current Gaps

- No client-side end-to-end tests for UI interactions yet.
- No persistence-layer tests (database not introduced yet).
- No production auth/session integration tests yet.
