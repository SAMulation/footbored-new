# FootBored 5.1 Roadmap

## Current State (Feb 8, 2026)
- Server/client/shared monorepo is buildable and lintable.
- Real-time socket game loop works with basic room join and card submission.
- Core rule logic is still prototype-level and needs deterministic validation.
- Mobile UI is functional but still placeholder-heavy for field/HUD experience.

## Guiding Strategy: Logic First, UX in Parallel
- Primary gate before deeper UX: deterministic, test-covered game logic that is playable outside the app.
- Ship terminal-playable gameplay for fast iteration and debugging.
- Keep socket integration validated continuously with a regression harness.
- Continue UX milestones once logic invariants are stable and measurable.

## Milestone A: Terminal-Playable Core (Now)
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

## Milestone B: Mobile Gameplay UX (Hour 6-8)
- Deliverables:
  - Field position visualization with animated ball marker.
  - First-down line and down-distance rendering.
  - Scoreboard and turn indicators.
  - Basic special-actions controls (punt/field goal/timeout) in UI.
- Exit criteria:
  - Mobile app renders live field state updates from server.
  - Visual updates remain in sync across two connected players.
  - `npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run lint` passes.

## Milestone C: Football Rules Depth
- Deliverables:
  - Expanded possession/scoring edge cases and special teams behavior.
  - Balance tuning for play matrix and yardage spread.
  - Explicit game-end handling and winner messaging consistency.
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
- Add authoritative move submission API in engine.
- Implement deterministic play-resolution matrix and bidirectional field movement.
- Add quarter/clock game-over progression.
- Add terminal human-vs-bot CLI mode.
- Add socket regression harness and test suite scripts.
