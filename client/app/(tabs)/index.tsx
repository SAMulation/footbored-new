import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TextInput, TouchableOpacity } from 'react-native';
import { PlayType } from '../../../shared/types';
import { useGameSocket } from '../../hooks/use-game-socket';
import { GameHud } from '@/components/game/GameHud';
import { FieldView } from '@/components/game/FieldView';
import { PlayerHand } from '@/components/game/PlayerHand';

const SPECIAL_ACTIONS: { type: PlayType; label: string }[] = [
  { type: 'PT', label: 'Punt' },
  { type: 'FG', label: 'Field Goal' },
  { type: 'TO', label: 'Timeout' },
];

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function GameScreen() {
  const {
    gameState,
    isConnected,
    roomId,
    seat,
    isRejoining,
    joinError,
    lastJoinWasRejoin,
    joinGame,
    playCard,
    playAgain,
  } = useGameSocket();
  const [roomInput, setRoomInput] = useState('TEST_ROOM');

  const mySide = seat ?? (gameState?.myState.teamName === 'Away Team' ? 'away' : 'home');
  const possession = gameState?.field.possessionPlayerId === 'away' ? 'away' : 'home';

  const isMyTurn = !!gameState &&
    (gameState.phase === 'OFFENSE_SELECT' || gameState.phase === 'DEFENSE_SELECT') &&
    !gameState.waitingForOpponent;
  const isOffenseTurn = !!gameState && isMyTurn && mySide === possession;

  const homeScore = gameState
    ? (mySide === 'home' ? gameState.myState.score : gameState.opponentState.score)
    : 0;
  const awayScore = gameState
    ? (mySide === 'away' ? gameState.myState.score : gameState.opponentState.score)
    : 0;

  const specialCardsByType = useMemo(() => {
    const byType = new Map<PlayType, string>();
    if (!gameState) return byType;

    for (const card of gameState.myState.hand) {
      if (!byType.has(card.type)) {
        byType.set(card.type, card.id);
      }
    }

    return byType;
  }, [gameState]);

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
      />

      <View style={styles.fieldArea}>
        {!gameState ? (
          <View style={styles.centerBox}>
            <Text style={styles.title}>FootBored 6.0</Text>
            <Text style={styles.roomLabel}>Room Code</Text>
            <TextInput
              value={roomInput}
              onChangeText={setRoomInput}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.roomInput}
              placeholder="ABCD"
              placeholderTextColor="#95a5a6"
              maxLength={8}
            />
            <View style={styles.joinActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={joinSelectedRoom}>
                <Text style={styles.primaryButtonText}>Join</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={createRoom}>
                <Text style={styles.secondaryButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.roomBadge}>ROOM: {roomId ?? 'N/A'}</Text>

            <FieldView
              ballOn={gameState.field.ballOn}
              toGo={gameState.field.toGo}
              offenseSide={possession}
            />

            <View style={styles.centerBox}>
              {gameState.waitingForOpponent ? (
                <Text style={styles.gameText}>Waiting for Opponent...</Text>
              ) : gameState.lastPlay ? (
                <View>
                  <Text style={styles.resultTitle}>PREVIOUS PLAY</Text>
                  <Text style={styles.gameText}>{gameState.lastPlay.message}</Text>
                </View>
              ) : (
                <Text style={styles.gameText}>Game Started! Pick a play.</Text>
              )}
            </View>

            {isOffenseTurn && (
              <View style={styles.specialActionRow}>
                {SPECIAL_ACTIONS.map((action) => {
                  const cardId = specialCardsByType.get(action.type);
                  if (!cardId) {
                    return null;
                  }

                  return (
                    <TouchableOpacity
                      key={action.type}
                      style={[styles.specialActionButton, isRejoining && styles.specialActionButtonDisabled]}
                      onPress={() => playCard(cardId)}
                      disabled={isRejoining}
                    >
                      <Text style={styles.specialActionText}>{action.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

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

        {isGameOver && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverTitle}>GAME OVER</Text>
            <Text style={styles.gameOverScore}>HOME {homeScore} - {awayScore} AWAY</Text>
            <Text style={styles.gameOverWinner}>WINNER: {winner}</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={playAgain}>
              <Text style={styles.primaryButtonText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {gameState && (
        <PlayerHand
          hand={gameState.myState.hand}
          onPlayCard={playCard}
          disabled={!isMyTurn || isGameOver || isRejoining}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  fieldArea: {
    flex: 1,
    backgroundColor: '#245b29',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 14,
  },
  centerBox: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  title: { fontSize: 24, color: 'white', fontWeight: 'bold', marginBottom: 20 },
  roomLabel: { color: '#d9d9d9', fontWeight: '700', fontSize: 12, marginBottom: 6 },
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
    marginBottom: 10,
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
  roomBadge: {
    color: '#d3efd4',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  gameText: { fontSize: 16, color: 'white', textAlign: 'center' },
  resultTitle: {
    color: '#f1c40f',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  specialActionRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  specialActionButton: {
    backgroundColor: '#7f4f24',
    borderColor: '#f4d03f',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  specialActionButtonDisabled: {
    opacity: 0.5,
  },
  specialActionText: {
    color: '#fff4cc',
    fontSize: 12,
    fontWeight: '800',
  },
  gameOverOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 48,
    backgroundColor: 'rgba(0,0,0,0.86)',
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
    fontSize: 20,
  },
  gameOverScore: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  gameOverWinner: {
    color: '#d7f7d8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
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
});
