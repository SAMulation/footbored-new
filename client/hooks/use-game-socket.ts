// client/hooks/use-game-socket.ts
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { ClientGameState } from '../../shared/types'; 

const LOCAL_IP = '192.168.0.12';
const PORT = '3000';
const ENV_SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL;

const DEFAULT_SERVER_URL = Platform.OS === 'web' 
  ? `http://localhost:${PORT}`
  : `http://${LOCAL_IP}:${PORT}`;

const SERVER_URL = (ENV_SERVER_URL || DEFAULT_SERVER_URL).replace(/\/$/, '');

export const useGameSocket = () => {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 1. Initialize Connection
    console.log('🔗 Connecting to:', SERVER_URL);
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
      const resolvedRoomId = roomId || 'TEST_ROOM';
      setRoomId(resolvedRoomId);
      socketRef.current.emit('JOIN_GAME', resolvedRoomId);
    }
  };

  const playCard = (cardId: string) => {
    if (socketRef.current && gameState && roomId) {
      socketRef.current.emit('PLAY_CARD', { roomId, cardId });
    }
  };

  const playAgain = () => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('RESET_GAME', { roomId });
    }
  };

  return {
    gameState,
    isConnected,
    roomId,
    joinGame,
    playCard,
    playAgain
  };
};
