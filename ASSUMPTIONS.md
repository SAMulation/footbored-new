# FootBored Assumptions Ledger

This file is append-only and tracks provisional implementation assumptions used to close previously OPEN rules while preserving reviewability.

## Entry Format
- Date: `YYYY-MM-DD`
- Rule ID: canonical rule identifier (for example `R-KICK-001`)
- Decision: concrete behavior chosen in code
- Rationale: why this assumption was chosen now
- Verification: test(s) or command(s) validating behavior
- Status: `ACTIVE` until superseded

## Entries

### 2026-02-08 - R-CLK-005
- Decision: Defensive timeout can ice only an offensive field goal attempt in the same turn; icing applies a deterministic penalty to field-goal success and consumes one defensive timeout.
- Rationale: Board text references icing but does not provide mechanics; this keeps behavior football-shaped and testable.
- Verification: `server/src/__tests__/assumptions-config.test.ts` (config load), plus FG/icing behavior tests to be added in subsequent commits.
- Status: ACTIVE

### 2026-02-08 - R-KICK-001
- Decision: Field-goal and punt resolution use deterministic assumptions configured in `/Users/sam/Downloads/Projects/footbored-new/server/src/rules/assumptions.ts` (distance bands, miss spot handling, punt gross/return ranges).
- Rationale: Rules are partially documented, so explicit assumptions are required to close OPEN guardrails without hidden behavior.
- Verification: `server/src/__tests__/assumptions-config.test.ts` (config load), plus kick behavior tests to be added in subsequent commits.
- Status: ACTIVE

### 2026-02-08 - R-KICK-002
- Decision: Kickoff flow is deterministic with explicit touchback and return-placement assumptions from `/Users/sam/Downloads/Projects/footbored-new/server/src/rules/assumptions.ts`.
- Rationale: Touchback/return mechanics are referenced in rules but not fully specified.
- Verification: `server/src/__tests__/assumptions-config.test.ts` (config load), plus kickoff behavior tests to be added in subsequent commits.
- Status: ACTIVE

### 2026-02-08 - Play Model (Virtual Specials)
- Rule IDs: `R-DECK-001`, `R-DECK-003`, `R-DECK-004` (implementation overlay)
- Decision: Keep random 3-card hand model for standard plays, and expose virtual special actions (`TP/HM/FG/PT/TO`) as selectable IDs outside the hand.
- Rationale: Improves practical playability quickly while preserving option to tune hand size and inventory model later.
- Verification: `server/src/__tests__/special-actions.test.ts` and bot/socket regressions.
- Status: ACTIVE
