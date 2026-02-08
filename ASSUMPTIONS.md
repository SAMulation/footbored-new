# FootBored Assumptions Ledger

This file is append-only and tracks provisional implementation assumptions used to close previously `OPEN` rules while preserving reviewability.

## Entry Format
- Date: `YYYY-MM-DD`
- Rule ID: canonical rule identifier (for example `R-KICK-001`)
- Decision: concrete behavior chosen in code
- Rationale: why this assumption was chosen now
- Verification: test(s) or command(s) validating behavior
- Status: `ACTIVE` until superseded

## Entries

### 2026-02-08 - Play Model (Virtual Specials)
- Rule IDs: `R-DECK-001`, `R-DECK-003`, `R-DECK-004` (implementation overlay)
- Decision: Keep random hand draw for standard cards and expose virtual special-action IDs (`TP/HM/FG/PT/TO`) outside the hand.
- Rationale: Enables full-game playability without blocking on an inventory-only refactor.
- Verification: `server/src/__tests__/special-actions.test.ts`
- Status: ACTIVE

### 2026-02-08 - R-KICK-001 (Punt + Field Goal)
- Decision: Punt uses deterministic gross (`36..52`) and return (`0..18`) with touchback to receiving `20`. Field goal uses deterministic distance bands (`<=34:0.95`, `<=44:0.83`, `<=54:0.67`, `<=65:0.42`, fallback `0.08`) with miss spot at line of scrimmage.
- Rationale: Board rules require these systems but do not provide complete numeric mechanics; deterministic assumptions keep multiplayer/replay stable.
- Verification: `server/src/__tests__/kicking-flow.test.ts`, `server/src/__tests__/field-goal-icing.test.ts`, `server/src/__tests__/assumptions-config.test.ts`
- Status: ACTIVE

### 2026-02-08 - R-KICK-002 (Kickoff)
- Decision: Kickoff uses deterministic touchback rate `0.34`; touchback starts at receiving `25`; non-touchback returns use deterministic placement range `18..34`; safety free kick uses receiving `50`.
- Rationale: Needed for score transitions and clock exception coupling with touchbacks.
- Verification: `server/src/__tests__/kicking-flow.test.ts`, `server/src/__tests__/assumptions-config.test.ts`
- Status: ACTIVE

### 2026-02-08 - R-CLK-005 (Ice the Kicker)
- Decision: Defense `TO` during offense `FG` consumes one defensive timeout and applies a deterministic field-goal penalty (`-0.12` success rate). Overtime FG icing uses the same penalty and does not trigger kickoff transitions.
- Rationale: "Ice the kicker" exists in board guidance but lacks explicit mechanics; deterministic penalty model is explicit and testable.
- Verification: `server/src/__tests__/field-goal-icing.test.ts`
- Status: ACTIVE
