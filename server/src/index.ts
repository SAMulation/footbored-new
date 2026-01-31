// server/src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid'; // For generating Room IDs

// Import our "Brain" and our "Contract"
import { GameEngine } from './Engine';
import { GamePhase, ClientGameState } from '../../shared/types';

// Standard Server Setup
const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- THE MEMORY STORE ---
// A Map is like a Dictionary or Hash Table.
// Key: Room ID (string) -> Value: The Game Engine Instance
const games = new Map<string, GameEngine>();

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`\n🚀 FBG-5.1 Server listening on port ${PORT}`);
});

/**
 * SECURITY HELPER
 * Takes the full Server State and strips out the opponent's hand.
 */
function getSanitizedState(game: GameEngine, playerId: string): ClientGameState {
  const { state } = game;
  const isHome = state.players.home.id === playerId;
  const myState = isHome ? state.players.home : state.players.away;
  const oppState = isHome ? state.players.away : state.players.home;

  return {
    phase: state.phase,
    field: state.field,
    lastPlay: state.lastPlay,
    
    // 1. My State: Full access (I need to see my own cards)
    myState: myState, 
    
    // 2. Opponent State: Restricted access
    opponentState: {
      username: oppState.username,
      score: oppState.score,
      timeouts: oppState.timeouts,
      deckCount: oppState.deckCount,
      // We ONLY tell the client the *count*, not the cards themselves!
      handCount: oppState.hand.length 
    },
    
    // UI Helper
    waitingForOpponent: (isHome && !!state.pendingMove.offenseCardId) || 
                        (!isHome && !!state.pendingMove.defenseCardId)
  };
}

io.on('connection', (socket: Socket) => {
  console.log('🔌 Connected:', socket.id);

  // EVENT 1: JOIN GAME
  socket.on('JOIN_GAME', (roomId: string) => {
    // If no room ID provided, create a new one
    if (!roomId) {
      roomId = uuidv4().substring(0, 4).toUpperCase(); // Short code: "AF4B"
    }

    // Join the socket "Room" (Socket.io feature)
    socket.join(roomId);

    // Get or Create the Game Engine
    let game = games.get(roomId);
    if (!game) {
      console.log(`Creating new game room: ${roomId}`);
      game = new GameEngine(roomId);
      games.set(roomId, game);
    }

    // Assign Player
    let myRole = '';
    if (game.state.players.home.id === 'home team') { 
      game.state.players.home.id = socket.id;
      myRole = 'HOME';
    } else if (game.state.players.away.id === 'away team') {
      game.state.players.away.id = socket.id;
      myRole = 'AWAY';
      
      // 🔥 THE FIX: Second player joined? START THE GAME!
      console.log(`⚡ Room ${roomId} is full. Starting game!`);
      game.startGame();
      
      // Notify Home player that game started (so they see the new Phase)
      const homeId = game.state.players.home.id;
      io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(game, homeId));
    } else {
      socket.emit('ERROR', 'Room is full');
      return;
    }

    console.log(`Player ${socket.id} joined ${roomId} as ${myRole}`);

    // Send the initial state to THIS player
    socket.emit('GAME_STATE_UPDATE', getSanitizedState(game, socket.id));
  });

  // EVENT 2: PLAY CARD
  socket.on('PLAY_CARD', ({ roomId, cardId }) => {
    const game = games.get(roomId);
    if (!game) return;

    // 1. Determine who played
    const isHome = game.state.players.home.id === socket.id;
    
    // 2. Store the move in "Pending"
    // The Engine logic sits waiting for both slots to be filled
    if (isHome) {
      game.state.pendingMove.offenseCardId = cardId;
    } else {
      game.state.pendingMove.defenseCardId = cardId;
    }

    // 3. Check if TURN COMPLETE
    const { offenseCardId, defenseCardId } = game.state.pendingMove;
    
    if (offenseCardId && defenseCardId) {
      // Both players moved! Trigger the Brain.
      console.log(`⚡ Resolving turn for Room ${roomId}`);
      game.resolveTurn();
      
      // Broadcast new state to BOTH players individually
      // (We map over the players to ensure they get their OWN sanitized view)
      const homeId = game.state.players.home.id;
      const awayId = game.state.players.away.id;
      
      io.to(homeId).emit('GAME_STATE_UPDATE', getSanitizedState(game, homeId));
      io.to(awayId).emit('GAME_STATE_UPDATE', getSanitizedState(game, awayId));
      
    } else {
      // Waiting for the other player...
      // Just send an update so the UI says "Waiting..."
      socket.emit('GAME_STATE_UPDATE', getSanitizedState(game, socket.id));
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    // Note: In a real app, handle reconnecting here!
  });
});