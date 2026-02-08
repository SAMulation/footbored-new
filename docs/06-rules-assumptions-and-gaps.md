# 06: Rules, Assumptions, and Gaps

This project intentionally separates "canonical rule intent" from "temporary implementation assumptions."

## Source Files

- Canonical reference:
  - `FOOTBORED_RULES.md`
- Assumption ledger:
  - `ASSUMPTIONS.md`
- Runtime assumption values:
  - `server/src/rules/assumptions.ts`
- Canonical matrix/tables:
  - `server/src/rules/canonical.ts`

## Why This Split Exists

The board-era game rules are partially recovered. To keep engineering progress moving without pretending uncertainty does not exist:

- canonical document marks known vs unresolved areas
- assumptions file records explicit temporary decisions
- tests pin current behavior so regressions are visible

## Canonical Layer (`rules/canonical.ts`)

Defines stable football-card primitives:

- standard quality matrix
- multiplier table
- TP and HM outcome code tables
- overtime start-spot constants
- quality deltas

Also includes `OPEN_RULE_IDS`, but in current code it is an empty list.

## Assumption Layer (`rules/assumptions.ts`)

Defines frozen config object `RULE_ASSUMPTIONS` with version tag and ranges.

Includes:

- kickoff touchback rates/spots
- punt ranges and touchback behavior
- FG distance bands + long-shot fallback + icing penalty
- XP success + 2PT required yards
- overtime bucket policy and thresholds
- balance knobs:
  - standard-play offsets
  - TP/HM outcome weights
  - bot decision thresholds

All values are immutable at runtime (`Object.freeze`) and guarded by tests.

## Traceability Pattern

When an assumption exists, there are usually 3 linked artifacts:

1. Statement in `ASSUMPTIONS.md`
2. Value in `rules/assumptions.ts`
3. One or more tests asserting behavior

This makes temporary rules auditable and replaceable later.

## Current Major Assumption Buckets

1. Kicking systems:
   - FG success bands, punt ranges, kickoff modeling.
2. Conversion probabilities:
   - XP deterministic rate, 2PT threshold model.
3. Overtime resource cadence:
   - two-period bucket resets and counts.
4. Balance overlays:
   - neutral defaults now, but intentionally tunable.
5. Recap reason tagging:
   - standardized message metadata for UX clarity.

## Known Open Questions (From Canonical Doc)

High-value unresolved areas still marked as "confirm before replacing/coding":

- board-authentic FG table and miss semantics
- board-authentic punt distribution details
- board-authentic kickoff procedure
- half-distance rounding semantics in big-play contexts
- some same-play and penalty edge clarifications
- board-authentic conversion distributions
- board-authentic OT bucket quantity values

## Practical Engineering Rule

Treat all assumption-backed behavior as stable-for-now contracts:

- do not "silently tweak" values
- if changing a value:
  - update assumption ledger entry
  - update test expectations
  - run full validation

## How to Safely Replace Assumptions Later

1. Confirm canonical value from high-confidence source.
2. Update `FOOTBORED_RULES.md` confidence/implementation notes.
3. Update `RULE_ASSUMPTIONS` values or replace assumption branch logic.
4. Add/adjust tests for new canonical behavior.
5. Record superseding entry in `ASSUMPTIONS.md`.

## For Product Planning

This rules architecture is a strength:

- you can ship gameplay now
- you can keep deterministic multiplayer integrity
- you can still converge to board-authentic behavior later without rewriting the whole engine
