import assert from 'node:assert/strict';

import { GamePhase, JoinGameAck, JoinGamePayload, PlayType } from '../../../shared/types';
import { createGameServer } from '../index';

const socketIoClient: any = require('socket.io-client');

interface ClientState {
  phase: string;
  waitingForOpponent: boolean;
  conversion?: {
    offenseSide: 'home' | 'away';
    attemptType: 'XP' | '2PT' | null;
    mandatoryTwoPoint: boolean;
  } | null;
  myState: {
    hand: Array<{ id: string; type: PlayType }>;
    specialActions?: Array<{ id: string; type: PlayType; enabled: boolean }>;
  };
  field: {
    ballOn: number;
    down: number;
    toGo: number;
    quarter: number;
    clockSeconds: number;
    isOvertime?: boolean;
    overtimePeriod?: number | null;
    awaitingZeroSecondPlay?: boolean;
  };
  lastPlay?: {
    message: string;
    yardsGained: number;
  };
}

function chooseCard(state: ClientState): string | undefined {
  const hand = state.myState.hand;
  const specialActions = state.myState.specialActions ?? [];
  const specialId = (type: PlayType) =>
    specialActions.find((action) => action.type === type && action.enabled)?.id;

  if (state.phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
    if (state.conversion?.mandatoryTwoPoint) {
      return specialId('2PT') ?? undefined;
    }
    return specialId('XP') ?? specialId('2PT') ?? undefined;
  }

  if (hand.length === 0) return undefined;

  if (state.field.down === 4) {
    const fieldGoal = specialId('FG');
    if (fieldGoal && state.field.ballOn >= 60) return fieldGoal;

    const punt = specialId('PT');
    if (punt) return punt;
  }

  if (state.field.toGo >= 14) {
    const hailMary = specialId('HM');
    if (hailMary) return hailMary;
  }

  if (state.field.toGo >= 8) {
    const trickPlay = specialId('TP');
    if (trickPlay) return trickPlay;
  }

  if (state.field.toGo <= 3) {
    return hand.find((card) => card.type === 'SR' || card.type === 'SP')?.id ?? hand[0].id;
  }

  return hand.find((card) => card.type === 'LR' || card.type === 'LP' || card.type === 'TP')?.id ?? hand[0].id;
}

function isValidTransition(prev: string | null, next: string): boolean {
  if (!prev || prev === next) return true;
  const allowed = new Set([
    `${GamePhase.LOBBY}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.OFFENSE_SELECT}->${GamePhase.RESOLUTION}`,
    `${GamePhase.DEFENSE_SELECT}->${GamePhase.RESOLUTION}`,
    `${GamePhase.RESOLUTION}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.RESOLUTION}->${GamePhase.DEFENSE_SELECT}`,
    `${GamePhase.RESOLUTION}->${GamePhase.CONVERSION_OFFENSE_SELECT}`,
    `${GamePhase.CONVERSION_OFFENSE_SELECT}->${GamePhase.CONVERSION_DEFENSE_SELECT}`,
    `${GamePhase.CONVERSION_OFFENSE_SELECT}->${GamePhase.CONVERSION_RESOLUTION}`,
    `${GamePhase.CONVERSION_DEFENSE_SELECT}->${GamePhase.CONVERSION_RESOLUTION}`,
    `${GamePhase.CONVERSION_RESOLUTION}->${GamePhase.OFFENSE_SELECT}`,
    `${GamePhase.CONVERSION_RESOLUTION}->${GamePhase.DEFENSE_SELECT}`,
    `${GamePhase.CONVERSION_RESOLUTION}->${GamePhase.GAME_OVER}`,
    `${GamePhase.RESOLUTION}->${GamePhase.GAME_OVER}`,
    `${GamePhase.OFFENSE_SELECT}->${GamePhase.GAME_OVER}`,
    `${GamePhase.DEFENSE_SELECT}->${GamePhase.GAME_OVER}`,
  ]);
  return allowed.has(`${prev}->${next}`);
}

async function connectClient(url: string): Promise<any> {
  const socket = socketIoClient(url, { transports: ['websocket'] });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('socket connect timeout')), 5000);
    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.on('connect_error', (err: unknown) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
  return socket;
}

async function emitJoin(socket: any, payload: JoinGamePayload): Promise<JoinGameAck> {
  return await new Promise<JoinGameAck>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('join ack timeout')), 5000);

    socket.once('JOIN_GAME_ACK', (ack: JoinGameAck) => {
      clearTimeout(timeout);
      resolve(ack);
    });

    socket.emit('JOIN_GAME', payload);
  });
}

function pause(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runTwoPlayerFullGameScenario(url: string, rooms: Map<string, any>) {
  const roomId = `ROOM${Date.now().toString().slice(-6)}`;

  const home = await connectClient(url);
  const away = await connectClient(url);
  let homeState: ClientState | null = null;
  let awayState: ClientState | null = null;
  let prevHomePhase: string | null = null;
  let prevAwayPhase: string | null = null;

  let resolutions = 0;
  const seenResolutionKeys = new Set<string>();
  const submittedTurnKey = new Map<string, string>([['home', ''], ['away', '']]);
  let homeReachedGameOver = false;
  let awayReachedGameOver = false;
  const readHomeState = (): ClientState | null => homeState;
  const readAwayState = (): ClientState | null => awayState;

  const handleState = (label: 'home' | 'away', state: ClientState) => {
    assert(state.field.ballOn >= 0 && state.field.ballOn <= 100, 'ballOn out of range');

    if (label === 'home') {
      assert(isValidTransition(prevHomePhase, state.phase), `invalid home transition ${prevHomePhase} -> ${state.phase}`);
      prevHomePhase = state.phase;
      homeState = state;
    } else {
      assert(isValidTransition(prevAwayPhase, state.phase), `invalid away transition ${prevAwayPhase} -> ${state.phase}`);
      prevAwayPhase = state.phase;
      awayState = state;
    }

    if (state.phase === GamePhase.RESOLUTION && state.lastPlay) {
      const key = `${state.field.quarter}:${state.field.clockSeconds}:${state.lastPlay.message}:${state.lastPlay.yardsGained}`;
      if (!seenResolutionKeys.has(key)) {
        seenResolutionKeys.add(key);
        resolutions += 1;
      }
    }
    if (state.phase === GamePhase.GAME_OVER) {
      if (label === 'home') homeReachedGameOver = true;
      if (label === 'away') awayReachedGameOver = true;
    }
  };

  home.on('GAME_STATE_UPDATE', (state: ClientState) => handleState('home', state));
  away.on('GAME_STATE_UPDATE', (state: ClientState) => handleState('away', state));

  const homeJoin = await emitJoin(home, { roomId, requestedSeat: 'home' });
  const awayJoin = await emitJoin(away, { roomId, requestedSeat: 'away' });
  assert.equal(homeJoin.seat, 'home');
  assert.equal(awayJoin.seat, 'away');

  const room = rooms.get(roomId);
  assert(room);
  room.game.state.players.home.score = 24;
  room.game.state.players.away.score = 3;
  room.game.state.field.possessionPlayerId = 'home';
  room.game.state.field.ballOn = 45;
  room.game.state.field.down = 1;
  room.game.state.field.toGo = 10;
  room.game.state.field.quarter = 4;
  room.game.state.field.clockSeconds = 30;
  room.game.state.field.awaitingZeroSecondPlay = false;
  room.game.syncState();

  const start = Date.now();
  try {
    while (Date.now() - start < 20000) {
      const currentHomeState = readHomeState();
      if (currentHomeState && isSelectablePhase(currentHomeState.phase) && !currentHomeState.waitingForOpponent) {
        const turnKey = `${currentHomeState.field.quarter}:${currentHomeState.field.clockSeconds}:${currentHomeState.field.down}:${currentHomeState.field.toGo}:${currentHomeState.field.ballOn}`;
        if (submittedTurnKey.get('home') !== turnKey) {
          const cardId = chooseCard(currentHomeState);
          if (cardId) {
            submittedTurnKey.set('home', turnKey);
            home.emit('PLAY_CARD', { roomId, cardId });
          }
        }
      }

      const currentAwayState = readAwayState();
      if (currentAwayState && isSelectablePhase(currentAwayState.phase) && !currentAwayState.waitingForOpponent) {
        const turnKey = `${currentAwayState.field.quarter}:${currentAwayState.field.clockSeconds}:${currentAwayState.field.down}:${currentAwayState.field.toGo}:${currentAwayState.field.ballOn}`;
        if (submittedTurnKey.get('away') !== turnKey) {
          const cardId = chooseCard(currentAwayState);
          if (cardId) {
            submittedTurnKey.set('away', turnKey);
            away.emit('PLAY_CARD', { roomId, cardId });
          }
        }
      }

      if (homeReachedGameOver && awayReachedGameOver && resolutions >= 1) {
        return;
      }

      await pause(50);
    }

    throw new Error('Two-player full-game scenario timed out');
  } finally {
    home.disconnect();
    away.disconnect();
  }
}

function isSelectablePhase(phase: string): boolean {
  return phase === GamePhase.OFFENSE_SELECT
    || phase === GamePhase.DEFENSE_SELECT
    || phase === GamePhase.CONVERSION_OFFENSE_SELECT
    || phase === GamePhase.CONVERSION_DEFENSE_SELECT;
}

async function runBotQuickPlayFullGameScenario(url: string, rooms: Map<string, any>) {
  const roomId = `BOT${Date.now().toString().slice(-6)}`;
  const client = await connectClient(url);

  let state: ClientState | null = null;
  const readState = (): ClientState | null => state;
  let prevPhase: string | null = null;
  let resolutions = 0;
  const seenResolutionKeys = new Set<string>();

  client.on('GAME_STATE_UPDATE', (next: ClientState) => {
    assert(next.field.ballOn >= 0 && next.field.ballOn <= 100, 'bot scenario ballOn out of range');
    assert(isValidTransition(prevPhase, next.phase), `invalid bot transition ${prevPhase} -> ${next.phase}`);
    prevPhase = next.phase;
    state = next;

    if (next.phase === GamePhase.RESOLUTION && next.lastPlay) {
      const key = `${next.field.quarter}:${next.field.clockSeconds}:${next.lastPlay.message}:${next.lastPlay.yardsGained}`;
      if (!seenResolutionKeys.has(key)) {
        seenResolutionKeys.add(key);
        resolutions += 1;
      }
    }
  });

  const ack = await emitJoin(client, { roomId, quickPlayBot: true });
  assert.equal(ack.mode, 'BOT');
  const room = rooms.get(roomId);
  assert(room);
  room.game.state.players.home.score = 28;
  room.game.state.players.away.score = 7;
  room.game.state.field.possessionPlayerId = ack.seat;
  room.game.state.field.ballOn = ack.seat === 'home' ? 40 : 60;
  room.game.state.field.down = 1;
  room.game.state.field.toGo = 10;
  room.game.state.field.quarter = 4;
  room.game.state.field.clockSeconds = 30;
  room.game.state.field.awaitingZeroSecondPlay = false;
  room.game.syncState();

  const start = Date.now();
  try {
    while (Date.now() - start < 16000) {
      const currentState = readState();
      if (currentState && isSelectablePhase(currentState.phase) && !currentState.waitingForOpponent) {
        const cardId = chooseCard(currentState);
        if (cardId) {
          client.emit('PLAY_CARD', { roomId, cardId });
        }
      }

      if (currentState?.phase === GamePhase.GAME_OVER && resolutions >= 1) {
        return;
      }

      await pause(50);
    }

    throw new Error('Bot quick-play full-game scenario timed out');
  } finally {
    client.disconnect();
  }
}

async function main() {
  const { httpServer, rooms } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve server port');
  }

  const url = `http://127.0.0.1:${address.port}`;

  try {
    await runTwoPlayerFullGameScenario(url, rooms);
    await runBotQuickPlayFullGameScenario(url, rooms);
    console.log('Socket regression passed (two-player + bot quick-play full-game completion).');
  } finally {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
}

main().catch((error) => {
  console.error('Socket regression failed:', error);
  process.exitCode = 1;
});
