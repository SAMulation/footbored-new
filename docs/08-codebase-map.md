# 08: Codebase Map (File-by-File Guide)

This is a practical "what file does what" map.

## Root

- `README.md`
  - setup/run commands and quick validation commands.
- `ROADMAP.md`
  - product/milestone progression.
- `UX_ROADMAP.md`
  - browser and interaction design execution notes.
- `FOOTBORED_RULES.md`
  - canonical rules source with confidence and open questions.
- `ASSUMPTIONS.md`
  - append-only ledger for temporary implementation decisions.
- `progress.md`
  - running execution log of recent work.

## Scripts

- `scripts/validate-all.sh`
  - full server/client validation chain.
- `scripts/playtest-web.sh`
  - starts server + Expo web for manual playtesting.
- `scripts/trace-state.sh`
  - wrapper around deterministic state trace simulation.

## Shared Contracts

- `shared/types.ts`
  - all shared game and socket payload types.
- `shared/constants.ts`
  - deck blueprints and core config.
- `shared/package.json`
  - package metadata.

## Server Package

### Build/runtime config

- `server/package.json`
  - run scripts (`dev`, `test`, `sim:socket`, `sim:trace`, etc.).
- `server/tsconfig.json`
  - compiles server + shared TS into `server/dist`.

### Runtime code

- `server/src/index.ts`
  - socket server, room/session orchestration, bot turn loop.
- `server/src/engine.ts`
  - complete authoritative gameplay state machine.
- `server/src/models/Deck.ts`
  - standard deck handling.
- `server/src/models/Hand.ts`
  - per-side hand management.
- `server/src/rules/canonical.ts`
  - canonical matrix/tables/open-rule guard list.
- `server/src/rules/assumptions.ts`
  - frozen assumption config values.

### Sim/CLI tools

- `server/src/cli/play-terminal.ts`
  - terminal play loop for fast non-UI iteration.
- `server/src/simulation.ts`
  - older basic simulation scaffold.
- `server/src/simulation/socket-regression.ts`
  - scenario-driven socket regression test harness.
- `server/src/simulation/state-trace.ts`
  - deterministic per-step trace generator.

### Tests

- `server/src/__tests__/assumptions-config.test.ts`
- `server/src/__tests__/bot-decision.test.ts`
- `server/src/__tests__/bot-quickplay.test.ts`
- `server/src/__tests__/canonical-rules.test.ts`
- `server/src/__tests__/conversion-flow.test.ts`
- `server/src/__tests__/engine-flow.test.ts`
- `server/src/__tests__/field-goal-icing.test.ts`
- `server/src/__tests__/kicking-flow.test.ts`
- `server/src/__tests__/open-rules-resolution.test.ts`
- `server/src/__tests__/overtime-clock.test.ts`
- `server/src/__tests__/play-message-flags.test.ts`
- `server/src/__tests__/reconnect-flow.test.ts`
- `server/src/__tests__/rules.test.ts`
- `server/src/__tests__/special-actions.test.ts`

## Client Package

### Build/runtime config

- `client/package.json`
  - Expo scripts and dependencies.
- `client/tsconfig.json`
  - TypeScript config with alias paths.
- `client/metro.config.js`
  - enables resolution of shared workspace files.
- `client/eslint.config.js`
  - lint config.
- `client/app.json`
  - Expo app metadata and plugins.

### App routes

- `client/app/_layout.tsx`
  - root stack setup.
- `client/app/(tabs)/_layout.tsx`
  - tab bar setup.
- `client/app/(tabs)/index.tsx`
  - main gameplay and lobby UI.
- `client/app/(tabs)/explore.tsx`
  - template/demo screen.
- `client/app/modal.tsx`
  - template modal screen.

### Game UI components

- `client/components/game/GameHud.tsx`
  - scoreboard/status HUD.
- `client/components/game/FieldView.tsx`
  - field rendering and ball animation.
- `client/components/game/PlayerHand.tsx`
  - action rail and hand list.
- `client/components/game/PlayCard.tsx`
  - individual card visuals.

### Hooks

- `client/hooks/use-game-socket.ts`
  - socket connection/join/play APIs + local state.
- `client/hooks/use-color-scheme.ts`
- `client/hooks/use-color-scheme.web.ts`
- `client/hooks/use-theme-color.ts`

### Template helper components

- `client/components/external-link.tsx`
- `client/components/haptic-tab.tsx`
- `client/components/hello-wave.tsx`
- `client/components/parallax-scroll-view.tsx`
- `client/components/themed-text.tsx`
- `client/components/themed-view.tsx`
- `client/components/ui/collapsible.tsx`
- `client/components/ui/icon-symbol.tsx`
- `client/components/ui/icon-symbol.ios.tsx`
- `client/constants/theme.ts`

### Utility script

- `client/scripts/reset-project.js`
  - Expo starter reset utility (not gameplay-specific).

## Artifacts and Generated Output

- `output/playwright/*`
  - visual QA screenshots.
- `server/.artifacts/traces/*`
  - deterministic trace outputs.
- `client/dist/*`
  - static web output.

## Reading Order for New Contributors

1. `docs/01-system-overview.md`
2. `shared/types.ts`
3. `server/src/index.ts`
4. `server/src/engine.ts`
5. `client/hooks/use-game-socket.ts`
6. `client/app/(tabs)/index.tsx`
7. `docs/07-roadmap-supabase-auth-lobbies.md`
