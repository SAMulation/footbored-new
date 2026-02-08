import { randomUUID } from 'node:crypto';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

import { ClientGameState, GamePhase, JoinGameAck, JoinGamePayload } from '../../shared/types';
import { GameEngine, TeamSide } from './engine';

export const REJOIN_TTL_MS = 10 * 60 * 1000;

type Seat = 'home' | 'away';

interface PlayerSession {
  token: string;
  seat: Seat;
  socketId: string;
  connected: boolean;
  lastSeenAt: number;
}

interface RoomContext {
  game: GameEngine;
  sessionsByToken: Map<string, PlayerSession>;
  tokenBySeat: Map<Seat, string>;
}

function getSanitizedState(game: GameEngine, playerId: string): ClientGameState {
  const { state } = game;
  const isHome = state.players.home.id === playerId;
  const myState = isHome ? state.players.home : state.players.away;
  const oppState = isHome ? state.players.away : state.players.home;
  const isHomeOffense = state.field.possessionPlayerId === 'home';
  const myPendingMove = isHome
    ? (isHomeOffense ? state.pendingMove.offenseCardId : state.pendingMove.defenseCardId)
    : (isHomeOffense ? state.pendingMove.defenseCardId : state.pendingMove.offenseCardId);

  return {
    phase: state.phase,
    field: state.field,
    lastPlay: state.lastPlay,
    myState,
    opponentState: {
      username: oppState.username,
      score: oppState.score,
      timeouts: oppState.timeouts,
      deckCount: oppState.deckCount,
      handCount: oppState.hand.length,
    },
    waitingForOpponent: !!myPendingMove,
  };
}

function createRoomContext(roomId: string): RoomContext {
  return {
    game: new GameEngine(roomId),
    sessionsByToken: new Map<string, PlayerSession>(),
    tokenBySeat: new Map<Seat, string>(),
  };
}

function applySessionToGameSeat(room: RoomContext, session: PlayerSession) {
  if (session.seat === 'home') {
    room.game.state.players.home.id = session.socketId;
  } else {
    room.game.state.players.away.id = session.socketId;
  }
}

function cleanupStaleSessions(room: RoomContext, now: number) {
  for (const [token, session] of room.sessionsByToken.entries()) {
    if (session.connected) {
      continue;
    }

    if (now - session.lastSeenAt < REJOIN_TTL_MS) {
      continue;
    }

    room.sessionsByToken.delete(token);
    room.tokenBySeat.delete(session.seat);

    if (session.seat === 'home') {
      room.game.state.players.home.id = 'home team';
    } else {
      room.game.state.players.away.id = 'away team';
    }
  }
}

function chooseSeat(room: RoomContext, requestedSeat?: Seat): Seat | null {
  if (requestedSeat && !room.tokenBySeat.has(requestedSeat)) {
    return requestedSeat;
  }

  if (!room.tokenBySeat.has('home')) return 'home';
  if (!room.tokenBySeat.has('away')) return 'away';
  return null;
}

function sendRoomState(io: Server, room: RoomContext) {
  const homeId = room.game.state.players.home.id;
  const awayId = room.game.state.players.away.id;

  if (homeId && homeId !== 'home team') {
    io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(room.game, homeId));
  }

  if (awayId && awayId !== 'away team') {
    io.to(awayId).emit('GAME_STATE_UPDATE', getSanitizedState(room.game, awayId));
  }
}

function asJoinPayload(input: string | JoinGamePayload): JoinGamePayload {
  if (typeof input === 'string') {
    return { roomId: input };
  }
  return input;
}

export function createGameServer() {
  const app = express();
  app.use(cors());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const rooms = new Map<string, RoomContext>();

  io.on('connection', (socket: Socket) => {
    console.log('🔌 Connected:', socket.id);

    socket.on('JOIN_GAME', (rawPayload: string | JoinGamePayload) => {
      const payload = asJoinPayload(rawPayload);
      const roomId = (payload.roomId || '').trim().toUpperCase() || randomUUID().substring(0, 4).toUpperCase();
      const now = Date.now();

      let room = rooms.get(roomId);
      if (!room) {
        room = createRoomContext(roomId);
        rooms.set(roomId, room);
      }

      cleanupStaleSessions(room, now);

      let session: PlayerSession | null = null;
      let rejoined = false;

      if (payload.playerToken) {
        const existing = room.sessionsByToken.get(payload.playerToken);
        if (existing) {
          session = existing;
          session.connected = true;
          session.socketId = socket.id;
          session.lastSeenAt = now;
          rejoined = true;
        }
      }

      if (!session) {
        const seat = chooseSeat(room, payload.requestedSeat);
        if (!seat) {
          socket.emit('ERROR', 'Room is full');
          return;
        }

        session = {
          token: randomUUID(),
          seat,
          socketId: socket.id,
          connected: true,
          lastSeenAt: now,
        };

        room.sessionsByToken.set(session.token, session);
        room.tokenBySeat.set(seat, session.token);
      }

      applySessionToGameSeat(room, session);
      socket.join(roomId);

      if (room.tokenBySeat.has('home') && room.tokenBySeat.has('away') && room.game.state.phase === GamePhase.LOBBY) {
        room.game.startGame();
      }

      const ack: JoinGameAck = {
        roomId,
        playerToken: session.token,
        seat: session.seat,
        rejoined,
      };

      socket.emit('JOIN_GAME_ACK', ack);
      sendRoomState(io, room);
    });

    socket.on('PLAY_CARD', ({ roomId, cardId }) => {
      const normalizedRoomId = (roomId || '').trim().toUpperCase();
      const room = rooms.get(normalizedRoomId);
      if (!room || !cardId) {
        return;
      }

      if (room.game.state.phase !== GamePhase.OFFENSE_SELECT && room.game.state.phase !== GamePhase.DEFENSE_SELECT) {
        return;
      }

      const side: TeamSide | null = room.game.state.players.home.id === socket.id
        ? 'home'
        : room.game.state.players.away.id === socket.id
          ? 'away'
          : null;

      if (!side) {
        return;
      }

      const result = room.game.submitMove(side, cardId);

      if (!result.accepted) {
        socket.emit('ERROR', result.reason || 'move_rejected');
        socket.emit('GAME_STATE_UPDATE', getSanitizedState(room.game, socket.id));
        return;
      }

      if (!result.resolved) {
        socket.emit('GAME_STATE_UPDATE', getSanitizedState(room.game, socket.id));
        return;
      }

      sendRoomState(io, room);
      room.game.advanceAfterResolution();
      sendRoomState(io, room);
    });

    socket.on('RESET_GAME', ({ roomId }) => {
      const normalizedRoomId = (roomId || '').trim().toUpperCase();
      const room = rooms.get(normalizedRoomId);
      if (!room) {
        return;
      }

      const isParticipant = room.game.state.players.home.id === socket.id || room.game.state.players.away.id === socket.id;
      if (!isParticipant) {
        return;
      }

      room.game.resetForRematch();

      const homeToken = room.tokenBySeat.get('home');
      const awayToken = room.tokenBySeat.get('away');
      if (homeToken) {
        const homeSession = room.sessionsByToken.get(homeToken);
        if (homeSession?.connected) {
          room.game.state.players.home.id = homeSession.socketId;
        }
      }
      if (awayToken) {
        const awaySession = room.sessionsByToken.get(awayToken);
        if (awaySession?.connected) {
          room.game.state.players.away.id = awaySession.socketId;
        }
      }

      sendRoomState(io, room);
    });

    socket.on('disconnect', () => {
      const now = Date.now();

      for (const room of rooms.values()) {
        for (const session of room.sessionsByToken.values()) {
          if (session.socketId === socket.id) {
            session.connected = false;
            session.lastSeenAt = now;
            break;
          }
        }
      }

      console.log('Player disconnected:', socket.id);
    });
  });

  return { app, httpServer, io, rooms };
}

if (require.main === module) {
  const { httpServer } = createGameServer();
  const PORT = process.env.PORT || 3000;

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 FBG-6.0 Server listening on port ${PORT}`);
  });
}
