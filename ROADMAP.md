# FootBored 5.1 Roadmap

## Current State (Feb 8, 2026)
- Server/client/shared monorepo is buildable and lintable.
- Real-time socket game loop works with authoritative engine-side move submission.
- Core rules are deterministic and backed by tests plus socket regression checks.
- Mobile UI now includes live field, HUD, room join/create flow, special-action controls, and a game-over replay overlay.

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
  - OPEN (intentionally guarded in code):
    - `R-DECK-005`, `R-MULT-002`, `R-SAME-003`, `R-TP-002`, `R-TP-003`, `R-FLD-003`, `R-FLD-004`.
    - Engine throws explicit rule guard errors for OPEN IDs instead of silently approximating behavior.
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

## Immediate Next Commit Checklist
- Add reconnect-safe room state restoration and rejoin UX.
- Add richer game-over details (per-play recap and quick rematch pairing behavior).
- Expand UI tests around room/join/replay and action-button legality.
