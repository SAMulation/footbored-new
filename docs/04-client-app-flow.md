# 04: Client App Flow

This explains how the Expo client is structured and how it interacts with the authoritative server.

## App Structure

- Router root:
  - `client/app/_layout.tsx`
- Tabs:
  - `client/app/(tabs)/_layout.tsx`
  - `client/app/(tabs)/index.tsx` (actual game screen)
  - `client/app/(tabs)/explore.tsx` (Expo template content)
- Socket hook:
  - `client/hooks/use-game-socket.ts`
- Gameplay components:
  - `client/components/game/GameHud.tsx`
  - `client/components/game/FieldView.tsx`
  - `client/components/game/PlayerHand.tsx`
  - `client/components/game/PlayCard.tsx`

## Important Note on Scope

Most gameplay UX lives in one large file:

- `client/app/(tabs)/index.tsx`

It currently owns:

- lobby flow
- in-game shell
- game-over overlay
- recommendation logic
- recap normalization
- confirm dialogs
- responsive layout mode switching

This is workable now, but should eventually be split into focused modules.

## Socket Hook (`useGameSocket`)

`client/hooks/use-game-socket.ts` handles:

- socket connection lifecycle
- reconnect behavior
- join/rejoin payload emission
- room and seat state
- token-per-room storage (in-memory ref)
- action emitters:
  - `joinGame`
  - `quickPlayBot`
  - `playCard`
  - `playAgain` (`RESET_GAME`)

Connection URL behavior:

- Uses `EXPO_PUBLIC_SERVER_URL` if provided.
- Fallback:
  - web: `http://localhost:3000`
  - native: `http://192.168.0.12:3000` (hardcoded local LAN default)

## Game Screen Control Flow (`index.tsx`)

The screen computes derived values from `gameState`:

- side/possession
- score and timeout projections
- in-turn status
- rail disabled reasons
- recommended card ID
- formatted recap context and transient toast messages

Then it renders:

- `LobbyShell` if not in game
- `InGameShell` if in game
- `GameOverShell` overlay when phase is `GAME_OVER`

## Lobby UX

`LobbyShell` includes:

- quick play bot button
- room code input
- join/create actions
- connection indicator

Create-room flow:

- generates 4-char code in UI
- calls `joinGame(code)`

## In-Game UX Composition

`InGameShell` includes:

- room + mode badges
- optional field-focus toggle
- transient gameplay notices and recap toast
- main field container (`FieldView`)
- context panel ("Pick your play", previous play, conversion prompts, etc.)
- desktop-right action rail (`PlayerHand` in sidebar mode)

Mobile/tablet mode:

- action rail appears as bottom command rail.

Desktop-wide mode:

- action rail moves to right rail panel.

## Recommendation Logic

In `index.tsx`, `recommendedCardId` is computed heuristically:

- conversion:
  - mandatory 2PT -> prefer `2PT`
  - otherwise prefer `XP`
- defense:
  - bias short/contain cards
- offense:
  - 4th-down FG/PT decisions by ball position and to-go
  - long distance: HM/LP/LR preference
  - short distance: SR/SP preference

This logic is UI guidance only; server still validates legality.

## High-Impact Confirmation

Before sending certain plays (`FG`, `PT`, `TO`, `2PT`), UI opens a confirm modal to reduce accidental taps.

## HUD (`GameHud.tsx`)

Shows:

- connection state (online/offline/rejoining)
- phase badge
- quarter/clock and down/to-go
- score blocks
- possession highlight
- timeout/deck counts
- pick/lock/resolve checklist chips
- prompt text based on phase and turn ownership

Includes phone-specific compact scoreboard mode.

## Field (`FieldView.tsx`)

Renders:

- field track with end zones
- major yard lines and hash marks
- line of scrimmage
- line to gain
- animated ball marker
- yard-number labels
- meta row (ball spot, line to gain, driving direction)

Uses viewport-aware sizing so it remains legible across web/mobile widths.

## PlayerHand Rail (`PlayerHand.tsx`)

Supports two modes:

- `bottom` (mobile/default)
- `sidebar` (desktop rail)

Features:

- special action grouping:
  - conversion
  - specials
  - clock
- status states:
  - `ready`, `locked`, `blocked`
- reason text for disabled actions
- recommended highlighting
- collapsible special section in sidebar mode
- horizontal carousel behavior on phone for action chips

## Card Component (`PlayCard.tsx`)

Card rendering encodes:

- family color language:
  - run, pass, special
- icon mapping by type
- responsive sizing for viewport and compact mode
- recommended badge
- disabled and pressed states

## Template vs Game-Specific Files

Still template/boilerplate oriented:

- `client/app/(tabs)/explore.tsx`
- `client/components/parallax-scroll-view.tsx`
- `client/components/themed-*`
- `client/components/ui/*` generic helpers
- `client/app/modal.tsx`

Game-specific production path:

- `client/app/(tabs)/index.tsx`
- `client/hooks/use-game-socket.ts`
- `client/components/game/*`

## Frontend Refactor Targets (Recommended)

1. Split `index.tsx` into:
   - `screens/GameScreen.tsx`
   - `screens/LobbyScreen.tsx`
   - `hooks/use-game-ui-state.ts`
2. Move recommendation and recap parsing to pure utility modules.
3. Extract style tokens to a dedicated game design system module.
4. Add explicit selector helpers for `home/away` projections to reduce repeated inline logic.
