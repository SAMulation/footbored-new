// client/hooks/useGameSocket.ts
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientGameState } from '../../shared/types'; // Import from our Monorepo Shared folder!

// ⚠️ REPLACE THIS WITH YOUR COMPUTER'S LOCAL IP ADDRESS!
// You can find this by running `ipconfig` (Windows) or `ifconfig` (Mac)
// Example: 'http://192.168.1.15:3000'
const SERVER_URL = '192.168.0.12:3000'; 

export const useGameSocket = () => {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 1. Initialize Connection
    socketRef.current = io(SERVER_URL, {
      transports: ['websocket'], // Force WebSocket to avoid polling issues
    });

    const socket = socketRef.current;

    // 2. Setup Listeners
    socket.on('connect', () => {
      console.log('✅ Connected to Server:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected');
      setIsConnected(false);
    });

    socket.on('GAME_STATE_UPDATE', (newState: ClientGameState) => {
      console.log('📩 State Updated:', newState.phase);
      setGameState(newState);
    });

    // 3. Cleanup on Unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // --- ACTIONS (The UI calls these) ---

  const joinGame = (roomId: string = 'TEST_ROOM') => {
    if (socketRef.current) {
      socketRef.current.emit('JOIN_GAME', roomId);
    }
  };

  const playCard = (cardId: string) => {
    if (socketRef.current && gameState) {
      // We need the RoomID (which currently lives in the Server state, not explicitly sent to client logic often)
      // For this simplified version, we assume 'TEST_ROOM' or we store roomId in client state.
      // Let's assume we hardcode 'TEST_ROOM' for Hour 4 verification.
      socketRef.current.emit('PLAY_CARD', { roomId: 'TEST_ROOM', cardId });
    }
  };

  return {
    gameState,
    isConnected,
    joinGame,
    playCard
  };
};