import assert from 'node:assert/strict';

import { GamePhase, PlayType } from '../../../shared/types';
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

async function main() {
  const { httpServer } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to resolve server port');
  }

  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `ROOM${Date.now().toString().slice(-6)}`;

  const home = await connectClient(url);
  const away = await connectClient(url);

  let resolutions = 0;
  const seenResolutionKeys = new Set<string>();
  const phaseByClient = new Map<string, string | null>([['home', null], ['away', null]]);
  const submittedTurnKey = new Map<string, string>([['home', ''], ['away', '']]);

  const completion = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Regression timeout before reaching 3 resolutions'));
    }, 15000);

    const onState = (clientLabel: 'home' | 'away', socket: any, state: ClientState) => {
      try {
        assert(state.field.ballOn >= 0 && state.field.ballOn <= 100, 'ballOn out of range');

        const prev = phaseByClient.get(clientLabel) ?? null;
        assert(isValidTransition(prev, state.phase), `invalid transition ${prev} -> ${state.phase}`);
        phaseByClient.set(clientLabel, state.phase);

        if (state.phase === GamePhase.RESOLUTION && state.lastPlay) {
          const key = `${state.field.quarter}:${state.field.clockSeconds}:${state.lastPlay.message}:${state.lastPlay.yardsGained}`;
          if (!seenResolutionKeys.has(key)) {
            seenResolutionKeys.add(key);
            resolutions += 1;
          }
        }

        if (resolutions >= 3) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        if ((state.phase === GamePhase.OFFENSE_SELECT || state.phase === GamePhase.DEFENSE_SELECT) && !state.waitingForOpponent) {
          const turnKey = `${state.field.quarter}:${state.field.clockSeconds}:${state.field.down}:${state.field.toGo}:${state.field.ballOn}`;
          if (submittedTurnKey.get(clientLabel) === turnKey) {
            return;
          }

          const cardId = chooseCard(state);
          if (!cardId) {
            return;
          }

          submittedTurnKey.set(clientLabel, turnKey);
          socket.emit('PLAY_CARD', { roomId, cardId });
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };

    home.on('GAME_STATE_UPDATE', (state: ClientState) => onState('home', home, state));
    away.on('GAME_STATE_UPDATE', (state: ClientState) => onState('away', away, state));
  });

  home.emit('JOIN_GAME', roomId);
  away.emit('JOIN_GAME', roomId);

  try {
    await completion;
    console.log('Socket regression passed (3+ resolutions, valid transitions, legal field state).');
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
