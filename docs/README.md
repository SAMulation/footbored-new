# FootBored Codebase Docs

This folder is a deep walkthrough of the current FootBored prototype.

If you want the fastest path:

1. Read `01-system-overview.md`.
2. Read `03-server-runtime-and-engine.md`.
3. Read `04-client-app-flow.md`.
4. Read `07-roadmap-supabase-auth-lobbies.md`.

## Document Index

- `01-system-overview.md`
  - What lives where, runtime topology, and the full play lifecycle.
- `02-shared-contracts.md`
  - Shared TypeScript contracts (`shared/types.ts`, `shared/constants.ts`) and why they are the glue between client and server.
- `03-server-runtime-and-engine.md`
  - Socket server architecture (`server/src/index.ts`) and game engine internals (`server/src/engine.ts`).
- `04-client-app-flow.md`
  - Expo router app, socket hook, main game screen composition, and component responsibilities.
- `05-testing-and-simulation.md`
  - Test matrix, socket regression harness, deterministic trace tooling, and recommended validation loops.
- `06-rules-assumptions-and-gaps.md`
  - Canonical rules vs assumption-backed behavior, and where current product risk is concentrated.
- `07-roadmap-supabase-auth-lobbies.md`
  - Practical migration plan for users, auth, private rooms, invites, persistence, and multi-platform Expo delivery.
- `08-codebase-map.md`
  - File-by-file map of what each tracked source/document file is responsible for.

## Quick Orientation

- Authoritative gameplay state lives on the server in `server/src/engine.ts`.
- Clients only submit intents (`PLAY_CARD`) and render sanitized state.
- Shared contracts in `shared/` define what both sides can send/receive.
- Current multiplayer lifecycle is in-memory only (no database yet).
- Rejoin support exists via token + room memory, but only while server process is alive.
