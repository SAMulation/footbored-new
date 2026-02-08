# FootBored 6.0

Real-time multiplayer football card prototype built as a TypeScript monorepo.

## Repo Layout

- `client/`: Expo React Native app
- `server/`: Node + Socket.IO authoritative game server
- `shared/`: shared game types and constants used by both sides

## Deep Documentation

- Start here: `docs/README.md`
- System overview: `docs/01-system-overview.md`
- Shared contracts: `docs/02-shared-contracts.md`
- Server runtime and engine: `docs/03-server-runtime-and-engine.md`
- Client app flow: `docs/04-client-app-flow.md`
- Testing and simulation: `docs/05-testing-and-simulation.md`
- Rules/assumptions and gaps: `docs/06-rules-assumptions-and-gaps.md`
- Supabase/auth/invite roadmap: `docs/07-roadmap-supabase-auth-lobbies.md`
- File-by-file map: `docs/08-codebase-map.md`

## Prerequisites

- Node.js 20+ (tested with modern Node)
- npm

## Install

Install dependencies in the two runnable packages:

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/client install
npm --prefix /Users/sam/Downloads/Projects/footbored-new/server install
```

## Environment

Client server URL can be configured with:

- `EXPO_PUBLIC_SERVER_URL` (preferred)

Example:

```bash
export EXPO_PUBLIC_SERVER_URL=http://192.168.0.12:3000
```

Fallback behavior when this env var is not set:

- Web: `http://localhost:3000`
- Native: `http://192.168.0.12:3000` (default LAN fallback in code)

## Run (Development)

Start server:

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run dev
```

Start client:

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run start
```

Common client targets:

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run ios
npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run android
npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run web
```

## Build

Server build:

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run build
```

Run built server:

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run start
```

## Local Multiplayer Setup

- Web + web: run two browser tabs on the same machine, both join the same room code.
- Phone + simulator/browser: set `EXPO_PUBLIC_SERVER_URL` to your machine's LAN IP and ensure both devices are on the same network.
- Default test room is `TEST_ROOM` unless a different room is passed to `joinGame`.

## Validation Commands

```bash
npm --prefix /Users/sam/Downloads/Projects/footbored-new/server run build
npm --prefix /Users/sam/Downloads/Projects/footbored-new/client run lint
```

## Quick Test Helpers

```bash
./scripts/validate-all.sh
./scripts/playtest-web.sh
./scripts/trace-state.sh --seed TRACE-01 --max-steps 350
```

`trace-state.sh` writes a readable step-by-step trace file under `server/.artifacts/traces/` by default.
