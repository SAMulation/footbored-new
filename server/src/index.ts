import { randomUUID } from 'node:crypto';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

import { ClientGameState, GamePhase, JoinGameAck, JoinGamePayload } from '../../shared/types';
import { GameEngine, TeamSide } from './engine';

export const REJOIN_TTL_MS = 10 * 60 * 1000;

type Seat = 'home' | 'away';
type BotDifficulty = 'easy' | 'normal';

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
  botEnabled: boolean;
  botSeat: Seat | null;
  botDifficulty: BotDifficulty;
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
    botEnabled: false,
    botSeat: null,
    botDifficulty: 'normal',
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
  const seatTaken = (seat: Seat) => room.tokenBySeat.has(seat) || room.botSeat === seat;

  if (requestedSeat && !seatTaken(requestedSeat)) {
    return requestedSeat;
  }

  if (!seatTaken('home')) return 'home';
  if (!seatTaken('away')) return 'away';
  return null;
}

function getOffenseSide(game: GameEngine): TeamSide {
  return game.state.field.possessionPlayerId === 'away' ? 'away' : 'home';
}

function isSelectablePhase(phase: GamePhase): boolean {
  return phase === GamePhase.OFFENSE_SELECT || phase === GamePhase.DEFENSE_SELECT;
}

function chooseBotCard(room: RoomContext): string | null {
  if (!room.botSeat) {
    return null;
  }

  const player = room.game.state.players[room.botSeat];
  const hand = player.hand;
  const offenseSide = getOffenseSide(room.game);
  const isOffense = room.botSeat === offenseSide;

  const specialId = (type: 'TP' | 'HM' | 'FG' | 'PT' | 'TO') => {
    return player.specialActions.find((action) => action.type === type && action.enabled)?.id ?? null;
  };

  if (room.botDifficulty === 'easy') {
    return hand[0]?.id ?? specialId('TP') ?? specialId('TO');
  }

  if (isOffense) {
    const { down, toGo, ballOn } = room.game.state.field;

    if (down === 4) {
      const fg = specialId('FG');
      const pt = specialId('PT');
      if (fg && ballOn >= 60) {
        return fg;
      }
      if (pt) {
        return pt;
      }
    }

    if (toGo >= 14) {
      const hm = specialId('HM');
      if (hm) {
        return hm;
      }
    }

    if (toGo >= 8) {
      const tp = specialId('TP');
      if (tp) {
        return tp;
      }
    }
  } else {
    const tp = specialId('TP');
    if (tp && room.game.state.field.toGo >= 8) {
      return tp;
    }
  }

  const { down, toGo } = room.game.state.field;
  if (toGo <= 3) {
    const short = hand.find((card) => card.type === 'SR' || card.type === 'SP');
    if (short) {
      return short.id;
    }
  } else {
    const long = hand.find((card) => card.type === 'LR' || card.type === 'LP' || card.type === 'TP');
    if (long) {
      return long.id;
    }
  }

  return hand[0]?.id ?? specialId('TO') ?? specialId('TP');
}

function maybeRunBotTurn(io: Server, room: RoomContext) {
  if (!room.botEnabled || !room.botSeat || !isSelectablePhase(room.game.state.phase)) {
    return;
  }

  const offenseSide = getOffenseSide(room.game);
  const slot = room.botSeat === offenseSide ? 'offenseCardId' : 'defenseCardId';
  if (room.game.state.pendingMove[slot]) {
    return;
  }

  const cardId = chooseBotCard(room);
  if (!cardId) {
    return;
  }

  const result = room.game.submitMove(room.botSeat, cardId);
  if (!result.accepted) {
    return;
  }

  if (!result.resolved) {
    sendRoomState(io, room);
    return;
  }

  sendRoomState(io, room);
  room.game.advanceAfterResolution();
  sendRoomState(io, room);
  maybeRunBotTurn(io, room);
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

      if (payload.quickPlayBot && !room.botEnabled && !payload.playerToken && room.tokenBySeat.size > 0) {
        socket.emit('ERROR', 'Quick Play requires an empty room');
        return;
      }

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
        if (room.botEnabled && !payload.quickPlayBot) {
          socket.emit('ERROR', 'Room is in BOT mode');
          return;
        }

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

      if (payload.quickPlayBot) {
        room.botEnabled = true;
        room.botDifficulty = payload.botDifficulty ?? 'normal';
        room.botSeat = session.seat === 'home' ? 'away' : 'home';

        if (room.botSeat === 'home') {
          room.game.state.players.home.id = 'BOT_HOME';
        } else {
          room.game.state.players.away.id = 'BOT_AWAY';
        }
      }

      socket.join(roomId);

      const hasHome = room.game.state.players.home.id !== 'home team';
      const hasAway = room.game.state.players.away.id !== 'away team';

      if (hasHome && hasAway && room.game.state.phase === GamePhase.LOBBY) {
        room.game.startGame();
      }

      const ack: JoinGameAck = {
        roomId,
        playerToken: session.token,
        seat: session.seat,
        rejoined,
        mode: room.botEnabled ? 'BOT' : 'MULTIPLAYER',
      };

      socket.emit('JOIN_GAME_ACK', ack);
      sendRoomState(io, room);
      maybeRunBotTurn(io, room);
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
        maybeRunBotTurn(io, room);
        return;
      }

      sendRoomState(io, room);
      room.game.advanceAfterResolution();
      sendRoomState(io, room);
      maybeRunBotTurn(io, room);
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

      if (room.botEnabled && room.botSeat) {
        if (room.botSeat === 'home') {
          room.game.state.players.home.id = 'BOT_HOME';
        } else {
          room.game.state.players.away.id = 'BOT_AWAY';
        }
      }

      sendRoomState(io, room);
      maybeRunBotTurn(io, room);
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
