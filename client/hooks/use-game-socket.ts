import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

import { ClientGameState, JoinGameAck, JoinGamePayload } from '../../shared/types';

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
  const [seat, setSeat] = useState<'home' | 'away' | null>(null);
  const [matchMode, setMatchMode] = useState<'MULTIPLAYER' | 'BOT' | null>(null);
  const [isRejoining, setIsRejoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lastJoinWasRejoin, setLastJoinWasRejoin] = useState(false);

  const tokenByRoomRef = useRef<Record<string, string>>({});
  const currentRoomRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const normalizedRoomId = useMemo(() => roomId?.trim().toUpperCase() ?? null, [roomId]);

  useEffect(() => {
    console.log('🔗 Connecting to:', SERVER_URL);

    socketRef.current = io(SERVER_URL, {
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);

      if (currentRoomRef.current) {
        const existingToken = tokenByRoomRef.current[currentRoomRef.current];
        const payload: JoinGamePayload = {
          roomId: currentRoomRef.current,
          playerToken: existingToken,
        };

        setIsRejoining(true);
        socket.emit('JOIN_GAME', payload);
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      if (currentRoomRef.current) {
        setIsRejoining(true);
      }
    });

    socket.on('JOIN_GAME_ACK', (ack: JoinGameAck) => {
      const normalized = ack.roomId.trim().toUpperCase();
      tokenByRoomRef.current[normalized] = ack.playerToken;
      setRoomId(normalized);
      setSeat(ack.seat);
      setMatchMode(ack.mode ?? 'MULTIPLAYER');
      setJoinError(null);
      setIsRejoining(false);
      setLastJoinWasRejoin(ack.rejoined);
    });

    socket.on('ERROR', (message: string) => {
      setJoinError(message || 'Unknown socket error');
      setIsRejoining(false);
    });

    socket.on('GAME_STATE_UPDATE', (newState: ClientGameState) => {
      setGameState(newState);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinGame = (requestedRoomId: string = 'TEST_ROOM') => {
    if (!socketRef.current) return;

    const normalized = requestedRoomId.trim().toUpperCase();
    if (!normalized) return;

    setRoomId(normalized);
    currentRoomRef.current = normalized;
    setJoinError(null);
    setIsRejoining(true);

    const payload: JoinGamePayload = {
      roomId: normalized,
      playerToken: tokenByRoomRef.current[normalized],
    };

    socketRef.current.emit('JOIN_GAME', payload);
  };

  const quickPlayBot = () => {
    if (!socketRef.current) return;

    const generated = `BOT${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setRoomId(generated);
    currentRoomRef.current = generated;
    setJoinError(null);
    setIsRejoining(true);

    const payload: JoinGamePayload = {
      roomId: generated,
      playerToken: tokenByRoomRef.current[generated],
      quickPlayBot: true,
      botDifficulty: 'normal',
    };

    socketRef.current.emit('JOIN_GAME', payload);
  };

  const playCard = (cardId: string) => {
    if (socketRef.current && gameState && normalizedRoomId && !isRejoining) {
      socketRef.current.emit('PLAY_CARD', { roomId: normalizedRoomId, cardId });
    }
  };

  const playAgain = () => {
    if (socketRef.current && normalizedRoomId) {
      socketRef.current.emit('RESET_GAME', { roomId: normalizedRoomId });
    }
  };

  return {
    gameState,
    isConnected,
    roomId: normalizedRoomId,
    seat,
    matchMode,
    isRejoining,
    joinError,
    lastJoinWasRejoin,
    joinGame,
    quickPlayBot,
    playCard,
    playAgain,
  };
};
