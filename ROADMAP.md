# FootBored 6.0 Roadmap

## Current State (Feb 8, 2026)
- Server/client/shared monorepo is buildable and lintable.
- Real-time socket game loop works with authoritative engine-side move submission.
- Core rules are deterministic and backed by tests plus socket regression checks.
- Mobile UI now includes live field, HUD, room join/create flow, special-action controls, and a game-over replay overlay.
- Assumption-backed kick/clock closures are tracked in `/Users/sam/Downloads/Projects/footbored-new/ASSUMPTIONS.md`.

## Guiding Strategy: Logic First, UX in Parallel
- Primary gate before deeper UX: deterministic, test-covered game logic that is playable outside the app.
- Ship terminal-playable gameplay for fast iteration and debugging.
- Keep socket integration validated continuously with a regression harness.
- Continue UX milestones once logic invariants are stable and measurable.

## Milestone A: Terminal-Playable Core (Complete)
- Deliverables:
  - `server/src/cli/play-terminal.ts` human-vs-bot terminal mode.
  - Authoritative engine move API (`submitMove`, `advanceAfterResolution`).
  - Deterministic offense-vs-defense resolution matrix.
  - Rules tests and engine-flow tests.
  - Socket regression harness script.
- Exit criteria:
  - `npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run build` passes.
  - `npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run test` passes.
  - `npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run sim:socket` passes.
  - `npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run cli:play` runs a full game loop without crash.

## Milestone B: Mobile Gameplay UX (Hour 6-8) (In Progress)
- Deliverables:
  - [x] Field position visualization with animated ball marker.
  - [x] First-down line and down-distance rendering.
  - [x] Scoreboard and turn indicators.
  - [x] Basic special-actions controls (punt/field goal/timeout) in UI.
  - [x] Game-over overlay with replay flow.
  - [x] Room input + create/join flow (no hardcoded room-only path).
- Exit criteria:
  - Mobile app renders live field state updates from server.
  - Visual updates remain in sync across two connected players.
  - `npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run lint` passes.

## Milestone C: Football Rules Depth
- Deliverables:
  - Expanded possession/scoring edge cases and special teams behavior.
  - Balance tuning for play matrix and yardage spread.
  - Explicit game-end handling and winner messaging consistency.
- Implemented vs OPEN (current):
  - Implemented:
    - Canonical standard quality matrix (`SR/LR/SP/LP`).
    - Canonical multiplier table (`K/Q/J/10` with `B/G/D/O/W`).
    - Deterministic TP/HM outcome-table routing in engine.
    - OPEN-rule closures for `R-DECK-005`, `R-MULT-002`, `R-SAME-003`, `R-TP-002`, `R-TP-003`, `R-FLD-003`, `R-FLD-004`, `R-CLK-005`, `R-KICK-001`, `R-KICK-002`.
    - Zero-second play window handling and college overtime staging.
  - OPEN (intentionally guarded in code):
    - No kick/clock guardrail IDs remain in `OPEN_RULE_IDS`.
    - Remaining unresolved canonical items are documented in `FOOTBORED_RULES.md` and assumption-gated where needed.
- Exit criteria:
  - Rules test suite covers scoring, turnover, quarter transitions, and game over.
  - No nondeterministic rule outcomes for identical inputs.
  - Documented rules table in repository docs.

## Milestone D: Multiplayer Productization
- Deliverables:
  - Room creation/join UX with user-facing codes.
  - Connection lifecycle handling (disconnect/rejoin safeguards).
  - Persisted or resumable match state strategy.
- Exit criteria:
  - Two clients can create/join private rooms from UI without hardcoded room IDs.
  - Reconnect path recovers game state without manual server restart.
  - Socket regression includes reconnect scenario.

## Exit Criteria per Milestone
- Milestone A:
  - `server build`, `server test`, and `sim:socket` all green.
- Milestone B:
  - Field/HUD UX renders stable on iOS/Android/web and lint is green.
- Milestone C:
  - Rules coverage expanded and deterministic test matrix complete.
- Milestone D:
  - Room lifecycle and reconnect workflows validated by scripted checks.

## Browser Playability Mini-Roadmap
- Slice 1 (this commit): Quick-play bot one-tab loop.
  - Exit criteria:
    - Browser user can click `Quick Play (vs Bot)` and start a match without second player.
    - Server bot submits moves through `submitMove` only.
    - `server test` and `sim:socket` include a bot quick-play scenario.
- Slice 2: Browser multiplayer polish.
  - Exit criteria:
    - Join/create room flow includes explicit in-room waiting/lobby status.
    - Rematch pairing keeps both players in same room without manual re-entry.
    - Two-tab browser regression passes for 3+ consecutive downs.
- Slice 3: Browser visual pass.
  - Exit criteria:
    - Hand, field, and HUD scale correctly on common desktop widths (1280/1440).
    - Card readability and action affordances meet baseline clickability/usability.
    - No layout overflow issues in Chrome and Safari web builds.

## Immediate Next Commit Checklist
- Add reconnect-safe room state restoration and rejoin UX.
- Add richer game-over details (per-play recap and quick rematch pairing behavior).
- Expand UI tests around room/join/replay and action-button legality.

## UX Roadmap Pointer
- Browser UI/UX execution details are now tracked in `/Users/sam/Downloads/Projects/footbored-new/UX_ROADMAP.md`.
- Keep this roadmap focused on product milestones and logic progression.
- Keep UI implementation phases, acceptance checks, and component ownership in the dedicated UX roadmap file.
