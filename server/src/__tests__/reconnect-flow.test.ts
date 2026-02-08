import assert from 'node:assert/strict';
import test from 'node:test';

import { JoinGameAck } from '../../../shared/types';
import { createGameServer, REJOIN_TTL_MS } from '../index';

const socketIoClient: any = require('socket.io-client');

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

async function join(socket: any, payload: { roomId: string; playerToken?: string; requestedSeat?: 'home' | 'away' }): Promise<JoinGameAck> {
  return await new Promise<JoinGameAck>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('join timeout')), 5000);
    socket.once('JOIN_GAME_ACK', (ack: JoinGameAck) => {
      clearTimeout(timeout);
      resolve(ack);
    });
    socket.emit('JOIN_GAME', payload);
  });
}

test('first join assigns seat and token', async () => {
  const { httpServer } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `R${Date.now().toString().slice(-5)}`;

  const client = await connectClient(url);
  const ack = await join(client, { roomId, requestedSeat: 'home' });

  assert.equal(ack.roomId, roomId);
  assert.equal(ack.seat, 'home');
  assert.equal(typeof ack.playerToken, 'string');
  assert.equal(ack.rejoined, false);

  client.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test('disconnect and reconnect with token restores seat', async () => {
  const { httpServer } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `R${Date.now().toString().slice(-5)}`;

  let client = await connectClient(url);
  const firstAck = await join(client, { roomId, requestedSeat: 'home' });
  client.disconnect();

  client = await connectClient(url);
  const secondAck = await join(client, { roomId, playerToken: firstAck.playerToken });

  assert.equal(secondAck.rejoined, true);
  assert.equal(secondAck.seat, 'home');
  assert.equal(secondAck.playerToken, firstAck.playerToken);

  client.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test('fresh token cannot steal occupied seat', async () => {
  const { httpServer } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `R${Date.now().toString().slice(-5)}`;

  const home = await connectClient(url);
  const away = await connectClient(url);
  const third = await connectClient(url);

  const homeAck = await join(home, { roomId, requestedSeat: 'home' });
  const awayAck = await join(away, { roomId, requestedSeat: 'away' });

  assert.equal(homeAck.seat, 'home');
  assert.equal(awayAck.seat, 'away');

  const roomFullError = await new Promise<string>((resolve) => {
    third.once('ERROR', (message: string) => resolve(message));
    third.emit('JOIN_GAME', { roomId, requestedSeat: 'home' });
  });

  assert.equal(roomFullError, 'Room is full');

  home.disconnect();
  away.disconnect();
  third.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test('stale disconnected seat can be reclaimed after TTL', async () => {
  const { httpServer, rooms } = createGameServer();
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));

  const address = httpServer.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  const roomId = `R${Date.now().toString().slice(-5)}`;

  const home = await connectClient(url);
  const homeAck = await join(home, { roomId, requestedSeat: 'home' });

  const room = rooms.get(roomId);
  assert(room);
  const session = room.sessionsByToken.get(homeAck.playerToken);
  assert(session);
  session.connected = false;
  session.lastSeenAt = Date.now() - (REJOIN_TTL_MS + 1000);

  const newcomer = await connectClient(url);
  const newAck = await join(newcomer, { roomId, requestedSeat: 'home' });

  assert.equal(newAck.seat, 'home');
  assert.notEqual(newAck.playerToken, homeAck.playerToken);

  home.disconnect();
  newcomer.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});
