# FootBored Canonical Rules (Board-First)

## Purpose and Scope
This document is the canonical, board-first rules reference for FootBored. It is written to prevent rule drift while rebuilding game logic in code.

This document:
- MUST preserve the original game logic as far as confirmed by primary sources.
- MUST mark unresolved items as `OPEN`.
- MUST NOT invent final behavior where evidence is incomplete.
- MUST use stable `Rule ID` values so code and tests can cite exact rules.

## Source of Truth Hierarchy
1. Board game versions and board photos.
2. Legacy game screenshots (digital versions).
3. User-provided AI summary text.
4. Current prototype code at `/Users/sam/Downloads/Projects/footbored-new/server/src/engine.ts` (non-canonical reference only).
5. Any rule not confirmed by sources 1-4 is `OPEN` and blocked for implementation.

## Source Index
| Source ID | Type | Description | Canonical Weight |
|---|---|---|---|
| `SRC-BOARD-01` | Board photo | Color paper board with explicit gameplay steps, matrix, multiplier table, same-card rules, OT notes, and kick notes. | Highest |
| `SRC-BOARD-02` | Board photo | White hand-drawn board with side notes on downs, matrix outcomes, FG/PT notes, and card flow. | Highest |
| `SRC-IMG-01` | Digital screenshot | Modern mobile FootBored screenshot with hand counts and UI state. | High |
| `SRC-IMG-02` | Digital screenshot | Legacy grayscale digital screenshot showing play labels and field presentation. | High |
| `SRC-AI-01` | Text summary | User-provided AI summary of prior code/rules; useful but non-authoritative when conflicting with board sources. | Medium |
| `SRC-CODE-01` | Code | Current prototype engine at `/Users/sam/Downloads/Projects/footbored-new/server/src/engine.ts`. | Low (non-canonical tie-breaker) |

## Canonical Terminology and Entities
- Standard plays: `SR`, `LR`, `SP`, `LP`.
- Special plays/actions: `TP`, `HM`, `FG`, `PT`, `TO`.
- Play quality labels: `B`, `G`, `D`, `O`, `W`.
- Multiplier ranks: `K`, `Q`, `J`, `10`.
- Yard card value domain: `0..10`.
- Possession model: offense and defense roles swap on turnover/score/kick transitions.

## Canonical Rules

### Core Loop and Play Resolution
**Rule ID:** `R-LOOP-001`  
**Canonical Statement:** The game MUST proceed as repeated possessions and play resolutions until end-of-half, end-of-regulation, or overtime resolution conditions are met.  
**Sources:** `SRC-BOARD-01`, `SRC-BOARD-02`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** No material conflict observed.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-LOOP-002`  
**Canonical Statement:** Standard offensive play resolution MUST follow: offense call -> defense call -> call-quality evaluation -> multiplier determination -> yard determination -> football state update.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-LOOP-003`  
**Canonical Statement:** Plays `SR/LR/SP/LP` MUST use the standard quality matrix path unless a special mechanic explicitly overrides it (for example Same Play mechanism, Trick/Hail outcomes).  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

### Card Inventories and Cycles
**Rule ID:** `R-DECK-001`  
**Canonical Statement:** Standard play inventory MUST be 12 cards per cycle: `SR x3`, `LR x3`, `SP x3`, `LP x3`.  
**Sources:** `SRC-BOARD-01`, `SRC-IMG-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-DECK-002`  
**Canonical Statement:** After the 12 standard cards are exhausted, the standard play cycle MUST reset.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-DECK-003`  
**Canonical Statement:** Each team MUST receive one `TP` per standard-play cycle.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Source wording is clear but exact reset timing wording varies slightly.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-DECK-004`  
**Canonical Statement:** Each team MUST receive three `HM` per regulation half.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Overtime HM wording conflicts elsewhere, but regulation-half count is stable.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-DECK-005`  
**Canonical Statement:** Overtime uses college-style possessions with one `HM` refresh per OT period, no timeout refresh dependency, and OT stage progression (`OT1-2` normal start at 25, `OT3-4` mandatory 2-point context, `OT5+` 2-point shootout only).  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Conflicting legacy wording resolved by explicit implementation choice for current prototype.  
**Implementation Gate:** Implemented.

### Standard Play Quality Matrix
**Rule ID:** `R-STD-001`  
**Canonical Statement:** Offense-vs-defense standard-call quality MUST use the following matrix (`rows=offense`, `columns=defense`).  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** No conflicting matrix values identified.  
**Implementation Gate:** Approved for coding.

| Off \ Def | SR | LR | SP | LP |
|---|---|---|---|---|
| SR | W | D | D | G |
| LR | G | O | B | G |
| SP | D | G | W | D |
| LP | B | G | G | O |

```json
{
  "SR": { "SR": "W", "LR": "D", "SP": "D", "LP": "G" },
  "LR": { "SR": "G", "LR": "O", "SP": "B", "LP": "G" },
  "SP": { "SR": "D", "LR": "G", "SP": "W", "LP": "D" },
  "LP": { "SR": "B", "LR": "G", "SP": "G", "LP": "O" }
}
```

### Multiplier Table
**Rule ID:** `R-MULT-001`  
**Canonical Statement:** Quality-to-multiplier conversion MUST use the following table by multiplier rank (`K/Q/J/10`) and quality (`B/G/D/O/W`).  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** No conflicting values found in available source set.  
**Implementation Gate:** Approved for coding.

| Card \ Quality | B | G | D | O | W |
|---|---:|---:|---:|---:|---:|
| K | 4.0 | 3.0 | 2.0 | 1.5 | 1.0 |
| Q | 3.0 | 2.0 | 1.0 | 1.0 | 0.5 |
| J | 2.0 | 1.0 | 0.5 | 0.0 | 0.0 |
| 10 | 0.0 | 0.0 | 0.0 | -1.0 | -1.0 |

```json
{
  "K":  { "B": 4.0, "G": 3.0, "D": 2.0, "O": 1.5, "W": 1.0 },
  "Q":  { "B": 3.0, "G": 2.0, "D": 1.0, "O": 1.0, "W": 0.5 },
  "J":  { "B": 2.0, "G": 1.0, "D": 0.5, "O": 0.0, "W": 0.0 },
  "10": { "B": 0.0, "G": 0.0, "D": 0.0, "O": -1.0, "W": -1.0 }
}
```

**Rule ID:** `R-MULT-002`  
**Canonical Statement:** Yardage calculation for normal standard plays MUST be `yards = YardCard(0..10) * Multiplier`, converted to integer yards by away-from-zero rounding (`ceil` positive, `floor` negative).  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Board text does not pin exact rounding semantics; implementation now pins one deterministic policy.  
**Implementation Gate:** Implemented.

### Same Play Mechanism
**Rule ID:** `R-SAME-001`  
**Canonical Statement:** If offense and defense call the same standard play (`SR/LR/SP/LP`), a coin flip MUST determine whether the Same Play mechanism triggers.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-SAME-002`  
**Canonical Statement:** If Same Play triggers, a multiplier-rank card MUST drive branch behavior exactly as follows:  
- `K`: coin decides offense big play vs defense big play.  
- `Q`: coin decides `3x` vs `0x`.  
- `J`: coin decides `0x` vs `-3x`.  
- `10`: second coin decides turnover vs no gain.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-SAME-003`  
**Canonical Statement:** Non-trigger behavior for same-play coin check falls back to normal matrix + multiplier resolution.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Board text ambiguity resolved with explicit fallback policy for deterministic implementation.  
**Implementation Gate:** Implemented.

### Big Play Outcomes
**Rule ID:** `R-BIG-001`  
**Canonical Statement:** Big Play MUST always favor the awarded side and MUST use weighted outcomes (`1/2`, `1/3`, `1/6`) as documented.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-BIG-002`  
**Canonical Statement:** Offense Big Play outcomes MUST be: `+25`, or `+max(40, half-distance-to-endzone)`, or touchdown.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Half-distance rounding method is not explicit.  
**Implementation Gate:** confirm before coding.

**Rule ID:** `R-BIG-003`  
**Canonical Statement:** Defense Big Play outcomes MUST be: offense `-10` and repeat down, or turnover with return `max(25, half-distance-to-endzone)`, or defensive touchdown.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Return placement and coordinate conversion depend on field model details not fully specified.  
**Implementation Gate:** confirm before coding.

### Trick Play (`TP`)
**Rule ID:** `R-TP-001`  
**Canonical Statement:** `TP` resolution MUST be a six-outcome die table (1/6 each): `LR+5`, `LP+5`, `4x`, `-3x`, own `-15` penalty, offense Big Play.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Core outcomes are stable; integration details vary.  
**Implementation Gate:** Approved for coding on outcomes; integration details still gated.

**Rule ID:** `R-TP-002`  
**Canonical Statement:** Trick `-15` own-penalty is side-specific: offense TP penalty consumes the down; defense TP penalty grants offense auto first down.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Legacy wording ambiguity resolved with explicit side-specific handling.  
**Implementation Gate:** Implemented.

**Rule ID:** `R-TP-003`  
**Canonical Statement:** TP outcomes are table-driven and ignore defense call for outcome math; defense card is returned unless both sides play TP, which uses a same-play TP profile.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Multiple plausible interpretations existed; current implementation locks one deterministic profile.  
**Implementation Gate:** Implemented.

### Hail Mary (`HM`)
**Rule ID:** `R-HM-001`  
**Canonical Statement:** `HM` MUST resolve via a six-outcome die table: `0`, `+20`, `+40`, touchdown, `-10` sack, interception at spot.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Distribution is stable; interception spot handling details depend on field model representation.  
**Implementation Gate:** Approved for coding on outcome table.

**Rule ID:** `R-HM-002`  
**Canonical Statement:** `HM` is a direct-outcome play and MUST NOT require standard matrix + multiplier + yard-card flow unless explicitly confirmed by future evidence.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** No direct conflict found; this is consistent with rule text intent.  
**Implementation Gate:** Approved for coding.

### Downs, Distance, Possession, and Field
**Rule ID:** `R-FLD-001`  
**Canonical Statement:** Gameplay MUST use football downs and distance tracking (`down`, `yards-to-go`) with first-down resets and possession flips on turnover conditions.  
**Sources:** `SRC-BOARD-01`, `SRC-BOARD-02`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-FLD-002`  
**Canonical Statement:** Turnover on downs behavior (failed conversion on 4th when not kicking) MUST be supported.  
**Sources:** `SRC-BOARD-02`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Board side notes align with football baseline behavior.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-FLD-003`  
**Canonical Statement:** Safety awards 2 points to defense and uses prototype free-kick reset (midfield, scoring team receiving) in regulation flow.  
**Sources:** `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Board evidence is limited; prototype adopts explicit safety semantics.  
**Implementation Gate:** Implemented.

**Rule ID:** `R-FLD-004`  
**Canonical Statement:** Engine uses offense-forward internal coordinates with adapter back to absolute `0..100` field state for clients.  
**Sources:** `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** This remains an engine-model choice rather than a board rule.  
**Implementation Gate:** Implemented.

### Clock, Periods, and Timeouts (`TO`)
**Rule ID:** `R-CLK-001`  
**Canonical Statement:** Regulation clock MUST normally tick by 30 seconds per play.  
**Sources:** `SRC-BOARD-01`, `SRC-BOARD-02`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-CLK-002`  
**Canonical Statement:** Clock exceptions MUST include at least: timeout plays, penalty plays, and touchback-on-kick cases.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Touchback behavior is implemented with explicit assumptions from `/Users/sam/Downloads/Projects/footbored-new/ASSUMPTIONS.md`.  
**Implementation Gate:** Implemented.

**Rule ID:** `R-CLK-003`  
**Canonical Statement:** Teams MUST have 3 timeouts per regulation half.  
**Sources:** `SRC-BOARD-01`, `SRC-BOARD-02`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-CLK-004`  
**Canonical Statement:** End-of-half and end-of-regulation "zero-second play" behavior MUST exist; exact untimed-down interaction rules remain `OPEN`.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Core concept is clear; edge handling requires confirmation.  
**Implementation Gate:** confirm before coding.

**Rule ID:** `R-CLK-005`  
**Canonical Statement:** Defense timeout on offense field-goal attempts applies deterministic icing penalty and consumes one timeout; this is implemented as an assumptions-led closure pending stronger board-era mechanics.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Board text confirms concept, not exact math; implementation uses explicit assumptions (`icingPenalty`) tracked in `/Users/sam/Downloads/Projects/footbored-new/ASSUMPTIONS.md`.  
**Implementation Gate:** Implemented.

### Overtime
**Rule ID:** `R-OT-001`  
**Canonical Statement:** Overtime MUST be untimed and college-style possession-based: each team gets one possession starting at opponent 25 per OT period.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Board/summary agreement is strong.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-OT-002`  
**Canonical Statement:** OT possession order MUST alternate by period, with OT1 order set by toss and first-possession side flipping each period.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** No conflict found.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-OT-003`  
**Canonical Statement:** Starting in 3OT, teams MUST attempt two-point conversions after touchdowns.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Two-point conversion base system details outside 3OT trigger remain open.  
**Implementation Gate:** confirm before coding.

### Kicking Systems (`FG`, `PT`, Kickoff)
**Rule ID:** `R-KICK-001`  
**Canonical Statement:** `FG` and `PT` are implemented with deterministic assumption tables/ranges (distance bands, miss spot behavior, punt gross/return/touchback).  
**Sources:** `SRC-BOARD-01`, `SRC-BOARD-02`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Board notes confirm system presence but not full distributions; prototype behavior is assumptions-led and logged in `/Users/sam/Downloads/Projects/footbored-new/ASSUMPTIONS.md`.  
**Implementation Gate:** Implemented.

**Rule ID:** `R-KICK-002`  
**Canonical Statement:** Kickoff behavior is implemented with deterministic touchback/return assumptions including touchback spot and timing flags.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `IMPLEMENTED`  
**Conflict Notes:** Prototype uses explicit assumption values for kickoff rates/spotting while board-authentic distributions remain to be confirmed.  
**Implementation Gate:** Implemented.

### Determinism and Replayability
**Rule ID:** `R-DET-001`  
**Canonical Statement:** Multiplayer resolution MUST be deterministic for equal input events; randomness (coin/die/deck draws) MUST be authoritative and replay-safe.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `LIKELY`  
**Conflict Notes:** Determinism is implementation-oriented but required for synchronized multiplayer.  
**Implementation Gate:** Approved for coding.

### Documentation Quality Scenarios
**Rule ID:** `R-DOC-001`  
**Canonical Statement:** Canonical coverage MUST include all play codes `SR/LR/SP/LP/TP/HM/FG/PT/TO` in confirmed or open form.  
**Sources:** `SRC-BOARD-01`, `SRC-IMG-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

**Rule ID:** `R-DOC-002`  
**Canonical Statement:** Matrix/table values MUST remain machine-readable and internally consistent with this document's canonical values.  
**Sources:** `SRC-BOARD-01`, `SRC-AI-01`  
**Confidence:** `CONFIRMED`  
**Conflict Notes:** None.  
**Implementation Gate:** Approved for coding.

## Open Questions (Do Not Implement Without Confirmation)
1. **Board-authentic FG probability model**
   - **What is unknown:** Final board-era FG odds by distance and exact miss-spot semantics.
   - **Conflicting evidence:** Board notes imply probabilistic FG logic but no complete canonical table is legible in current artifacts.
   - **Required confirmation:** Recover/confirm original FG table to replace current assumption bands.
   - **Implementation Gate:** confirm before replacing assumptions.

2. **Board-authentic punt distribution**
   - **What is unknown:** Exact gross/return distributions, touchback placement, and blocked-punt edge handling from prior physical/digital rulesets.
   - **Conflicting evidence:** Punt is present in sources, but full numeric procedure is incomplete.
   - **Required confirmation:** Recover/confirm canonical punt table to replace current deterministic ranges.
   - **Implementation Gate:** confirm before replacing assumptions.

3. **Board-authentic kickoff procedure**
   - **What is unknown:** Original kickoff touchback spot/rates and return modeling specifics.
   - **Conflicting evidence:** Clock rules reference kick touchbacks but detailed kickoff mechanics remain partly illegible.
   - **Required confirmation:** Confirm canonical kickoff flow to replace current deterministic assumptions.
   - **Implementation Gate:** confirm before replacing assumptions.

4. **Rounding for fractional multipliers**
   - **What is unknown:** Integer conversion for products using `1.5` and `0.5`.
   - **Conflicting evidence:** No explicit rounding statement in board text.
   - **Required confirmation:** Choose and lock one policy (for example floor toward zero, nearest, etc.).
   - **Implementation Gate:** confirm before coding.

5. **Same Play tails branch**
   - **What is unknown:** Explicit rule when initial same-play trigger coin is tails.
   - **Conflicting evidence:** Common interpretation is standard-matrix fallback, but wording is indirect.
   - **Required confirmation:** Explicitly confirm tails behavior.
   - **Implementation Gate:** confirm before coding.

6. **Trick penalty down handling**
   - **What is unknown:** Whether `TP` result `-15` repeats down or advances down.
   - **Conflicting evidence:** Defensive big-play penalty explicitly repeats down; trick penalty wording is less explicit.
   - **Required confirmation:** Explicit down progression behavior for `TP` penalty outcome.
   - **Implementation Gate:** confirm before coding.

7. **Half-distance rounding semantics**
   - **What is unknown:** Exact rounding for "half the distance to endzone" in big-play contexts.
   - **Conflicting evidence:** None explicit; missing precision only.
   - **Required confirmation:** Lock rounding formula (`floor`, `ceil`, etc.).
   - **Implementation Gate:** confirm before coding.

8. **Safety and conversion details**
   - **What is unknown:** Safety handling and complete PAT/2-point baseline outside explicit 3OT requirement.
   - **Conflicting evidence:** Overtime note references 2-point requirement, but full conversion system is not fully documented.
   - **Required confirmation:** Define baseline PAT/2PT process and safety transitions.
   - **Implementation Gate:** confirm before coding.

9. **OT inventory reset cadence**
   - **What is unknown:** Exact HM/TO resets per OT period versus OT buckets.
   - **Conflicting evidence:** Summary text contains internal conflict.
   - **Required confirmation:** Confirm authoritative OT bucket/reset scheme.
   - **Implementation Gate:** confirm before coding.

## Non-Canonical Current Prototype Snapshot
Current prototype behavior in `/Users/sam/Downloads/Projects/footbored-new/server/src/engine.ts` diverges from canonical rules in these major ways:

1. Kicking (`FG/PT/Kickoff`) and icing are implemented with explicit assumptions, not fully recovered board-era tables.
2. Standard-card usage remains hand-draw driven in runtime with virtual specials, not yet a strict board inventory-only flow.
3. Some advanced football detail remains assumption-based or partial: conversion baseline outside OT rules, half-distance semantics, and full OT inventory cadence.
4. Determinism is hash-seeded and replay-safe for multiplayer, but still models inferred procedure where source text is incomplete.

These prototype behaviors MUST be treated as temporary implementation state, not canon.

## Decision Log
- **2026-02-08:** Adopted board-first source hierarchy and marked unresolved rules as `OPEN`.
- **2026-02-08:** Locked canonical matrix and multiplier values from highest-confidence available sources.
- **2026-02-08:** Prohibited silent fallback to current prototype behavior when canonical evidence is incomplete.
- **2026-02-08:** Chose one-file canonical rules documentation format for long-term reference.
- **2026-02-08:** Locked OPEN resolution policies for rounding, same-play fallback, TP handling, safety semantics, and offense-forward coordinate modeling.
- **2026-02-08:** Adopted college-style overtime staging for prototype (`OT1-2` normal, `OT3-4` mandatory conversion context, `OT5+` shootout).
- **2026-02-08:** Closed `R-CLK-005`, `R-KICK-001`, and `R-KICK-002` in code using explicit assumptions tracked in `/Users/sam/Downloads/Projects/footbored-new/ASSUMPTIONS.md`.

## Change Log
- **2026-02-08:** Initial creation of canonical rules reference (`v1.0` baseline).
- **2026-02-08:** Promoted `R-DECK-005`, `R-MULT-002`, `R-SAME-003`, `R-TP-002`, `R-TP-003`, `R-FLD-003`, and `R-FLD-004` from OPEN to IMPLEMENTED.
- **2026-02-08:** Promoted `R-CLK-002`, `R-CLK-005`, `R-KICK-001`, and `R-KICK-002` to IMPLEMENTED (assumption-backed closures).
