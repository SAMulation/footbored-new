# UX Roadmap: Broadcast HUD Browser Pass

## Vision
- Deliver a browser-first gameplay experience that feels like a live broadcast control panel while preserving FootBored's tactile card identity.
- Keep the interface grounded in game context at all times: score, clock, possession, down-distance, and immediate play prompt.
- Make the play-selection rail the strongest interaction anchor so every turn is fast and obvious.

## Current UI Audit
- `client/components/game/GameHud.tsx`: clear baseline but too sparse for fast tactical reads in browser sessions.
- `client/components/game/FieldView.tsx`: functional spot/line-of-gain visualization, but lacks field drama and yard readability.
- `client/app/(tabs)/index.tsx`: lobby/game/game-over states share one presentation shell, reducing hierarchy clarity.
- `client/components/game/PlayerHand.tsx` and `client/components/game/PlayCard.tsx`: strongest continuity with prior versions; should remain central.

## Design Principles
- Broadcast-first hierarchy:
  - Top strip should answer "What is happening right now?" in one glance.
- Field-first center:
  - Ball spot, line to gain, and directionality should stay visually obvious.
- Action certainty:
  - "Pick your play" context and legal actions should live in one lower command zone.
- Preserve proven motifs:
  - Keep card color language (run/pass/special) and quick readability from existing builds.
- Browser density, mobile-safe:
  - Improve desktop information density without breaking mobile-web/native layouts.

## Phased Execution Plan
1. Foundation shell split
- Refactor gameplay screen into explicit `LobbyShell`, `InGameShell`, and `GameOverShell` render paths.
- Keep socket behavior unchanged and isolate changes to layout/composition only.

2. Broadcast HUD upgrade
- Expand HUD data blocks for score, quarter/clock, down-distance, possession, connection state, active phase prompt, timeouts, and deck counts.
- Use football-native palette (charcoal, field greens, gold highlights) and compact block geometry.

3. Field + context upgrade
- Improve field anchoring with clearer yard structure and visual emphasis for line of scrimmage and line to gain.
- Move prior-play and turn instruction into a dedicated context panel beneath the field.

4. Action rail upgrade
- Integrate special actions (punt/field goal/timeout) into the same lower rail as hand cards.
- Increase card scanability and affordances on desktop widths while preserving current icon/color language.

5. Responsive polish and regression pass
- Validate browser layouts for 1280/1440 widths with no clipping/overflow.
- Verify mobile-web fallback behavior and keep native layout functional.

## Component Ownership Map
- `client/app/(tabs)/index.tsx`
  - Owns mode shells (`LobbyShell`, `InGameShell`, `GameOverShell`) and high-level page composition.
- `client/components/game/GameHud.tsx`
  - Owns broadcast top strip and phase/turn context.
- `client/components/game/FieldView.tsx`
  - Owns field rendering, ball animation, line-of-gain visualization, and yard readability.
- `client/components/game/PlayerHand.tsx`
  - Owns lower command rail composition (special actions + hand cards).
- `client/components/game/PlayCard.tsx`
  - Owns card-level visual affordances and press/disabled behavior.

Legacy reference mapping:
- Broadcast header (legacy screenshot) -> `GameHud`.
- Midfield control readability (legacy/paper sketches) -> `FieldView` + context panel in `index.tsx`.
- "Pick your play" command cadence (legacy versions) -> action rail in `PlayerHand`.
- Card identity continuity (recent browser build) -> `PlayCard`.

## Acceptance Criteria
- Lobby:
  - Quick play starts bot flow in one click.
  - Join/create paths keep existing behavior and error messaging.
- In-game:
  - Browser user can read score, clock, possession, down-distance, and phase prompt at a glance.
  - Field and context panel remain stable with no clipping at 1280/1440 widths.
- Action rail:
  - Primary play cards and special actions are co-located and clearly actionable.
  - Disabled/turn-state affordances are visually obvious.
- End game:
  - Game-over overlay remains readable and replay action works as before.

## Regression Checklist
- `npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run lint`
- `npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run test`
- Manual smoke: quick-play bot flow on browser.
- Manual smoke: two-tab multiplayer join and one down resolution.

## Open Questions / Deferred Ideas
- Whether to introduce branded team abbreviations/logos once metadata exists.
- Whether to add optional drive chart/play timeline in browser-only layout.
- Whether to introduce a retro scoreboard skin as an optional theme after broadcast baseline stabilizes.
