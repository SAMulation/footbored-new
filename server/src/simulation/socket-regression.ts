import assert from 'node:assert/strict';

import { GamePhase, JoinGameAck, JoinGamePayload, PlayType } from '../../../shared/types';
import { createGameServer } from '../index';

const socketIoClient: any = require('socket.io-client');

interface ClientState {
  phase: string;
  waitingForOpponent: boolean;
  myState: {
    hand: Array<{ id: string; type: PlayType }>;
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
  if (hand.length === 0) return undefined;

  if (state.field.down === 4) {
    const punt = hand.find((card) => card.type === 'PT');
    if (punt) return punt.id;
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

async function main() {
  const { httpServer, rooms } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve server port');
  }

  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `ROOM${Date.now().toString().slice(-6)}`;

  let home = await connectClient(url);
  const away = await connectClient(url);
  let homeState: ClientState | null = null;
  let awayState: ClientState | null = null;
  let prevHomePhase: string | null = null;
  let prevAwayPhase: string | null = null;

  let resolutions = 0;
  const seenResolutionKeys = new Set<string>();
  const submittedTurnKey = new Map<string, string>([['home', ''], ['away', '']]);
  let hasRejoined = false;
  let sawZeroSecondWindow = false;
  let sawOvertime = false;
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

    if (state.field.awaitingZeroSecondPlay) {
      sawZeroSecondWindow = true;
    }
    if (state.field.isOvertime) {
      sawOvertime = true;
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
  room.game.state.players.home.score = 21;
  room.game.state.players.away.score = 21;
  room.game.state.field.quarter = 4;
  room.game.state.field.clockSeconds = 30;
  room.game.state.field.awaitingZeroSecondPlay = false;

  let homeToken = homeJoin.playerToken;

  const start = Date.now();
  try {
    while (Date.now() - start < 22000) {
      if (!hasRejoined && resolutions >= 1) {
        hasRejoined = true;
        home.disconnect();
        await pause(80);
        home = await connectClient(url);
        const rejoinAck = await emitJoin(home, { roomId, playerToken: homeToken });
        assert.equal(rejoinAck.rejoined, true);
        assert.equal(rejoinAck.seat, 'home');
        homeToken = rejoinAck.playerToken;
        submittedTurnKey.set('home', '');
        home.on('GAME_STATE_UPDATE', (state: ClientState) => handleState('home', state));
      }

      const currentHomeState = readHomeState();
      if (currentHomeState && (currentHomeState.phase === GamePhase.OFFENSE_SELECT || currentHomeState.phase === GamePhase.DEFENSE_SELECT) && !currentHomeState.waitingForOpponent) {
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
      if (currentAwayState && (currentAwayState.phase === GamePhase.OFFENSE_SELECT || currentAwayState.phase === GamePhase.DEFENSE_SELECT) && !currentAwayState.waitingForOpponent) {
        const turnKey = `${currentAwayState.field.quarter}:${currentAwayState.field.clockSeconds}:${currentAwayState.field.down}:${currentAwayState.field.toGo}:${currentAwayState.field.ballOn}`;
        if (submittedTurnKey.get('away') !== turnKey) {
          const cardId = chooseCard(currentAwayState);
          if (cardId) {
            submittedTurnKey.set('away', turnKey);
            away.emit('PLAY_CARD', { roomId, cardId });
          }
        }
      }

      if (hasRejoined && resolutions >= 3 && sawZeroSecondWindow && sawOvertime) {
        console.log('Socket regression passed (rejoin continuity + valid transitions + legal field state).');
        return;
      }

      await pause(50);
    }

    throw new Error('Regression timeout before rejoin + zero-second + overtime assertions completed');
  } finally {
    home.disconnect();
    away.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
}

main().catch((error) => {
  console.error('Socket regression failed:', error);
  process.exitCode = 1;
});
