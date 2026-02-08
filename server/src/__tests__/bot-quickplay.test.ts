import assert from 'node:assert/strict';
import test from 'node:test';

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
  };
  lastPlay?: {
    message: string;
    yardsGained: number;
  };
}

function chooseCard(state: ClientState): string | undefined {
  const specialActions = state.myState.specialActions ?? [];
  const specialId = (type: PlayType) =>
    specialActions.find((action) => action.type === type && action.enabled)?.id;

  if (state.phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
    if (state.conversion?.mandatoryTwoPoint) {
      return specialId('2PT') ?? undefined;
    }
    return specialId('XP') ?? specialId('2PT') ?? undefined;
  }

  const hand = state.myState.hand;
  if (hand.length === 0) return undefined;
  const nonTimeout = hand.find((card) => card.type !== 'TO');

  if (state.field.down === 4) {
    const punt = hand.find((card) => card.type === 'PT');
    if (punt) return punt.id;
  }

  if (state.field.toGo <= 3) {
    return hand.find((card) => card.type === 'SR' || card.type === 'SP')?.id ?? nonTimeout?.id ?? hand[0].id;
  }

  return hand.find((card) => card.type === 'LR' || card.type === 'LP' || card.type === 'TP')?.id ?? nonTimeout?.id ?? hand[0].id;
}

async function connectClient(url: string): Promise<any> {
  const socket = socketIoClient(url, { transports: ['websocket'] });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('connect timeout')), 5000);
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

test('quick play creates bot seat and starts game', async () => {
  const { httpServer, rooms } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `BOT${Date.now().toString().slice(-5)}`;

  const client = await connectClient(url);
  const ack = await emitJoin(client, { roomId, quickPlayBot: true });

  assert.equal(ack.mode, 'BOT');
  const room = rooms.get(roomId);
  assert(room);
  assert.equal(room.botEnabled, true);
  assert(room.botSeat);
  assert.notEqual(room.botSeat, ack.seat);
  assert.equal(room.game.state.phase, GamePhase.OFFENSE_SELECT);

  client.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test('quick play bot resolves repeated turns without stalling', async () => {
  const { httpServer } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `BOT${Date.now().toString().slice(-5)}`;

  const client = await connectClient(url);
  const stateRef: { current: ClientState | null } = { current: null };
  let updates = 0;
  let lastSnapshot = 'none';
  let resolutions = 0;
  client.on('GAME_STATE_UPDATE', (state: ClientState) => {
    stateRef.current = state;
    updates += 1;
    lastSnapshot = `${state.phase}|wait=${state.waitingForOpponent}|down=${state.field.down}|toGo=${state.field.toGo}|ball=${state.field.ballOn}`;
    if (state.phase === GamePhase.RESOLUTION) {
      resolutions += 1;
    }
  });

  const ack = await emitJoin(client, { roomId, quickPlayBot: true });
  assert.equal(ack.mode, 'BOT');

  let submittedTurnKey = '';
  const start = Date.now();

  try {
    while (Date.now() - start < 12000) {
      const state = stateRef.current;
      if (state) {
        assert(state.field.ballOn >= 0 && state.field.ballOn <= 100);

        if ((
          state.phase === GamePhase.OFFENSE_SELECT
            || state.phase === GamePhase.DEFENSE_SELECT
            || state.phase === GamePhase.CONVERSION_OFFENSE_SELECT
            || state.phase === GamePhase.CONVERSION_DEFENSE_SELECT
        ) && !state.waitingForOpponent) {
          const turnKey = `${state.field.quarter}:${state.field.clockSeconds}:${state.field.down}:${state.field.toGo}:${state.field.ballOn}`;
          if (submittedTurnKey !== turnKey) {
            const cardId = chooseCard(state);
            if (cardId) {
              submittedTurnKey = turnKey;
              client.emit('PLAY_CARD', { roomId, cardId });
            }
          }
        }
      }

      if (resolutions >= 3) {
        return;
      }

      await pause(60);
    }
  } finally {
    client.disconnect();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }

  assert.fail(`timed out waiting for repeated quick-play resolutions (updates=${updates}, resolutions=${resolutions}, last=${lastSnapshot})`);
});
