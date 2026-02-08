import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { FieldView } from '@/components/game/FieldView';
import { GameHud } from '@/components/game/GameHud';
import { PlayerHand, SpecialActionItem } from '@/components/game/PlayerHand';
import { useGameSocket } from '../../hooks/use-game-socket';
import { ClientGameState, PlayType } from '../../../shared/types';

const SPECIAL_ACTIONS: { type: PlayType; label: string }[] = [
  { type: 'TP', label: 'Trick Play' },
  { type: 'HM', label: 'Hail Mary' },
  { type: 'FG', label: 'Field Goal' },
  { type: 'PT', label: 'Punt' },
  { type: 'TO', label: 'Timeout' },
];

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function resolvePlayContext(gameState: ClientGameState, isMyTurn: boolean): { title: string; message: string } {
  if (gameState.waitingForOpponent) {
    return {
      title: 'STATUS',
      message: 'Waiting for opponent to lock in a card...',
    };
  }
  if (gameState.lastPlay?.message) {
    return {
      title: 'PREVIOUS PLAY',
      message: gameState.lastPlay.message,
    };
  }
  if (isMyTurn) {
    return {
      title: 'PICK YOUR PLAY',
      message: 'Select one card from your rail to resolve this down.',
    };
  }
  return {
    title: 'STATUS',
    message: 'Opponent is choosing their card.',
  };
}

interface LobbyShellProps {
  roomInput: string;
  onRoomInputChange: (value: string) => void;
  onQuickPlay: () => void;
  onJoinRoom: () => void;
  onCreateRoom: () => void;
  isConnected: boolean;
}

function LobbyShell({
  roomInput,
  onRoomInputChange,
  onQuickPlay,
  onJoinRoom,
  onCreateRoom,
  isConnected,
}: LobbyShellProps) {
  return (
    <View style={styles.lobbyShell}>
      <View style={styles.lobbyPanel}>
        <View style={styles.lobbyHeader}>
          <Text style={styles.title}>FootBored 6.0</Text>
          <Text style={styles.lobbyConnection}>{isConnected ? 'Server Online' : 'Server Offline'}</Text>
        </View>

        <TouchableOpacity style={styles.quickPlayButton} onPress={onQuickPlay}>
          <Text style={styles.quickPlayButtonText}>Quick Play (vs Bot)</Text>
        </TouchableOpacity>

        <Text style={styles.advancedLabel}>Advanced Multiplayer</Text>
        <Text style={styles.roomLabel}>Room Code</Text>
        <TextInput
          value={roomInput}
          onChangeText={onRoomInputChange}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.roomInput}
          placeholder="ABCD"
          placeholderTextColor="#95a5a6"
          maxLength={8}
        />
        <View style={styles.joinActions}>
          <TouchableOpacity style={styles.primaryButton} onPress={onJoinRoom}>
            <Text style={styles.primaryButtonText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={onCreateRoom}>
            <Text style={styles.secondaryButtonText}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

interface InGameShellProps {
  gameState: ClientGameState;
  roomId: string | null;
  matchMode: 'MULTIPLAYER' | 'BOT' | null;
  isMyTurn: boolean;
  possession: 'home' | 'away';
}

function InGameShell({ gameState, roomId, matchMode, isMyTurn, possession }: InGameShellProps) {
  const playContext = resolvePlayContext(gameState, isMyTurn);

  return (
    <View style={styles.inGameShell}>
      <View style={styles.inGameTopRow}>
        {matchMode === 'BOT' ? <Text style={styles.modeBadge}>BOT MATCH</Text> : <View />}
        <Text style={styles.roomBadge}>ROOM: {roomId ?? 'N/A'}</Text>
      </View>

      <View style={styles.fieldFrame}>
        <FieldView
          ballOn={gameState.field.ballOn}
          toGo={gameState.field.toGo}
          offenseSide={possession}
        />
      </View>

      <View style={styles.playContextPanel}>
        <Text style={styles.playContextTitle}>{playContext.title}</Text>
        <Text style={styles.playContextText}>{playContext.message}</Text>
      </View>
    </View>
  );
}

interface GameOverShellProps {
  homeScore: number;
  awayScore: number;
  winner: string;
  onPlayAgain: () => void;
}

function GameOverShell({ homeScore, awayScore, winner, onPlayAgain }: GameOverShellProps) {
  return (
    <View style={styles.gameOverOverlay}>
      <Text style={styles.gameOverTitle}>GAME OVER</Text>
      <Text style={styles.gameOverScore}>HOME {homeScore} - {awayScore} AWAY</Text>
      <Text style={styles.gameOverWinner}>WINNER: {winner}</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onPlayAgain}>
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GameScreen() {
  const {
    gameState,
    isConnected,
    roomId,
    seat,
    matchMode,
    isRejoining,
    joinError,
    lastJoinWasRejoin,
    joinGame,
    quickPlayBot,
    playCard,
    playAgain,
  } = useGameSocket();
  const [roomInput, setRoomInput] = useState('TEST_ROOM');

  const mySide = seat ?? (gameState?.myState.teamName === 'Away Team' ? 'away' : 'home');
  const possession = gameState?.field.possessionPlayerId === 'away' ? 'away' : 'home';

  const isMyTurn = !!gameState &&
    (gameState.phase === 'OFFENSE_SELECT' || gameState.phase === 'DEFENSE_SELECT') &&
    !gameState.waitingForOpponent;

  const homeScore = gameState
    ? (mySide === 'home' ? gameState.myState.score : gameState.opponentState.score)
    : 0;
  const awayScore = gameState
    ? (mySide === 'away' ? gameState.myState.score : gameState.opponentState.score)
    : 0;
  const homeTimeouts = gameState
    ? (mySide === 'home' ? gameState.myState.timeouts : gameState.opponentState.timeouts)
    : 3;
  const awayTimeouts = gameState
    ? (mySide === 'away' ? gameState.myState.timeouts : gameState.opponentState.timeouts)
    : 3;
  const homeDeckCount = gameState
    ? (mySide === 'home' ? gameState.myState.deckCount : gameState.opponentState.deckCount)
    : 0;
  const awayDeckCount = gameState
    ? (mySide === 'away' ? gameState.myState.deckCount : gameState.opponentState.deckCount)
    : 0;

  const specialActionsByType = useMemo(() => {
    const byType = new Map<PlayType, { id: string; enabled: boolean; remaining: number | null }>();
    if (!gameState) return byType;

    for (const action of gameState.myState.specialActions) {
      if (!byType.has(action.type)) {
        byType.set(action.type, {
          id: action.id,
          enabled: action.enabled,
          remaining: action.remaining,
        });
      }
    }

    return byType;
  }, [gameState]);

  const specialActionItems = useMemo(() => {
    if (!gameState || !isMyTurn) {
      return [];
    }

    return SPECIAL_ACTIONS
      .map((action) => {
        const state = specialActionsByType.get(action.type);
        if (!state) return null;
        const suffix = state.remaining === null ? '' : ` (${state.remaining})`;
        return {
          cardId: state.id,
          label: `${action.label}${suffix}`,
          enabled: state.enabled,
        };
      })
      .filter((item): item is SpecialActionItem => item !== null);
  }, [gameState, isMyTurn, specialActionsByType]);

  const joinSelectedRoom = () => {
    const normalized = roomInput.trim().toUpperCase();
    if (!normalized) {
      return;
    }
    joinGame(normalized);
  };

  const createRoom = () => {
    const code = generateRoomCode();
    setRoomInput(code);
    joinGame(code);
  };

  const isGameOver = gameState?.phase === 'GAME_OVER';
  const winner = homeScore === awayScore ? 'DRAW' : homeScore > awayScore ? 'HOME' : 'AWAY';

  return (
    <SafeAreaView style={styles.container}>
      <GameHud
        homeScore={homeScore}
        awayScore={awayScore}
        quarter={gameState?.field.quarter ?? 1}
        clockSeconds={gameState?.field.clockSeconds ?? 900}
        down={gameState?.field.down ?? 1}
        toGo={gameState?.field.toGo ?? 10}
        possession={possession}
        isConnected={isConnected}
        isRejoining={isRejoining}
        phase={gameState?.phase ?? null}
        waitingForOpponent={gameState?.waitingForOpponent ?? false}
        isMyTurn={isMyTurn}
        homeTimeouts={homeTimeouts}
        awayTimeouts={awayTimeouts}
        homeDeckCount={homeDeckCount}
        awayDeckCount={awayDeckCount}
      />

      <View style={styles.playSurface}>
        <View style={styles.surfaceContent}>
          {!gameState ? (
            <LobbyShell
              roomInput={roomInput}
              onRoomInputChange={setRoomInput}
              onQuickPlay={quickPlayBot}
              onJoinRoom={joinSelectedRoom}
              onCreateRoom={createRoom}
              isConnected={isConnected}
            />
          ) : (
            <InGameShell
              gameState={gameState}
              roomId={roomId}
              matchMode={matchMode}
              isMyTurn={isMyTurn}
              possession={possession}
            />
          )}
        </View>

        <View style={styles.bannerStack}>
          {isRejoining && (
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerText}>Reconnecting...</Text>
            </View>
          )}
          {!isRejoining && lastJoinWasRejoin && seat && (
            <View style={styles.bannerInfo}>
              <Text style={styles.bannerText}>Rejoined as {seat.toUpperCase()}</Text>
            </View>
          )}
          {joinError && (
            <View style={styles.bannerError}>
              <Text style={styles.bannerText}>{joinError}</Text>
            </View>
          )}
        </View>

        {isGameOver && (
          <GameOverShell
            homeScore={homeScore}
            awayScore={awayScore}
            winner={winner}
            onPlayAgain={playAgain}
          />
        )}
      </View>

      {gameState && (
        <PlayerHand
          hand={gameState.myState.hand}
          onPlayCard={playCard}
          specialActions={specialActionItems}
          disabled={!isMyTurn || isGameOver || isRejoining}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1215',
  },
  playSurface: {
    flex: 1,
    width: '100%',
    backgroundColor: '#245b29',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'relative',
  },
  surfaceContent: {
    width: '100%',
    maxWidth: 1200,
    flex: 1,
  },
  lobbyShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  lobbyPanel: {
    width: '100%',
    maxWidth: 950,
    backgroundColor: 'rgba(11, 46, 20, 0.84)',
    borderColor: 'rgba(94, 148, 96, 0.6)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  lobbyHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: '900',
    textAlign: 'center',
  },
  lobbyConnection: {
    color: '#bde3c1',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  quickPlayButton: {
    width: '100%',
    backgroundColor: '#f1c40f',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  quickPlayButtonText: {
    color: '#1e1e1e',
    fontWeight: '900',
    fontSize: 15,
  },
  advancedLabel: {
    color: '#c0d8c2',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  roomLabel: {
    color: '#d9d9d9',
    fontWeight: '700',
    fontSize: 12,
  },
  roomInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#4c5b4d',
    backgroundColor: '#1f2820',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  joinActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: '#2d8a3e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: '#3b4d3e',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#dfe7df',
    fontWeight: '700',
    fontSize: 13,
  },
  inGameShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  inGameTopRow: {
    width: '100%',
    maxWidth: 1000,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeBadge: {
    color: '#1f1600',
    backgroundColor: '#f1c40f',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  roomBadge: {
    color: '#d3efd4',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  fieldFrame: {
    width: '100%',
    maxWidth: 1050,
    backgroundColor: 'rgba(12, 43, 18, 0.5)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(106, 176, 118, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  playContextPanel: {
    width: '100%',
    maxWidth: 1050,
    backgroundColor: 'rgba(4, 34, 14, 0.86)',
    borderColor: 'rgba(84, 149, 97, 0.62)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
  },
  playContextTitle: {
    color: '#f1c40f',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  playContextText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  bannerStack: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    alignItems: 'center',
    gap: 6,
  },
  bannerInfo: {
    backgroundColor: 'rgba(41,128,185,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerError: {
    backgroundColor: 'rgba(192,57,43,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gameOverOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 28,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderColor: '#f1c40f',
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  gameOverTitle: {
    color: '#f1c40f',
    fontWeight: '900',
    fontSize: 22,
  },
  gameOverScore: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  gameOverWinner: {
    color: '#d7f7d8',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
});
