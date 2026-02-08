import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { ClientGameState, GamePhase } from '../../shared/types';
import { GameEngine, TeamSide } from './engine';

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

export function createGameServer() {
  const app = express();
  app.use(cors());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const games = new Map<string, GameEngine>();

  io.on('connection', (socket: Socket) => {
    console.log('🔌 Connected:', socket.id);

    socket.on('JOIN_GAME', (requestedRoomId: string) => {
      const roomId = requestedRoomId || uuidv4().substring(0, 4).toUpperCase();
      socket.join(roomId);

      let game = games.get(roomId);
      if (!game) {
        game = new GameEngine(roomId);
        games.set(roomId, game);
      }

      if (game.state.players.home.id === 'home team') {
        game.state.players.home.id = socket.id;
      } else if (game.state.players.away.id === 'away team') {
        game.state.players.away.id = socket.id;
        game.startGame();

        const homeId = game.state.players.home.id;
        io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(game, homeId));
      } else {
        socket.emit('ERROR', 'Room is full');
        return;
      }

      socket.emit('GAME_STATE_UPDATE', getSanitizedState(game, socket.id));
    });

    socket.on('PLAY_CARD', ({ roomId, cardId }) => {
      const game = games.get(roomId);
      if (!game || !cardId) {
        return;
      }

      if (game.state.phase !== GamePhase.OFFENSE_SELECT && game.state.phase !== GamePhase.DEFENSE_SELECT) {
        return;
      }

      const side: TeamSide | null = game.state.players.home.id === socket.id
        ? 'home'
        : game.state.players.away.id === socket.id
          ? 'away'
          : null;

      if (!side) {
        return;
      }

      const result = game.submitMove(side, cardId);

      if (!result.accepted) {
        socket.emit('ERROR', result.reason || 'move_rejected');
        socket.emit('GAME_STATE_UPDATE', getSanitizedState(game, socket.id));
        return;
      }

      if (!result.resolved) {
        socket.emit('GAME_STATE_UPDATE', getSanitizedState(game, socket.id));
        return;
      }

      const homeId = game.state.players.home.id;
      const awayId = game.state.players.away.id;

      io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(game, homeId));
      io.to(awayId).emit('GAME_STATE_UPDATE', getSanitizedState(game, awayId));

      game.advanceAfterResolution();

      io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(game, homeId));
      io.to(awayId).emit('GAME_STATE_UPDATE', getSanitizedState(game, awayId));
    });

    socket.on('RESET_GAME', ({ roomId }) => {
      const game = games.get(roomId);
      if (!game) {
        return;
      }

      const isParticipant = game.state.players.home.id === socket.id || game.state.players.away.id === socket.id;
      if (!isParticipant) {
        return;
      }

      game.resetForRematch();

      const homeId = game.state.players.home.id;
      const awayId = game.state.players.away.id;
      io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(game, homeId));
      io.to(awayId).emit('GAME_STATE_UPDATE', getSanitizedState(game, awayId));
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
    });
  });

  return { app, httpServer, io, games };
}

if (require.main === module) {
  const { httpServer } = createGameServer();
  const PORT = process.env.PORT || 3000;

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 FBG-5.1 Server listening on port ${PORT}`);
  });
}
