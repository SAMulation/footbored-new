// client/app/(tabs)/index.tsx
import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, Button } from 'react-native';
import { useGameSocket } from '../../hooks/use-game-socket';
import { PlayerHand } from '@/components/game/PlayerHand';

export default function GameScreen() {
  const { gameState, isConnected, joinGame, playCard } = useGameSocket();

  // Helper: Is it my turn?
  // We can play if we are in a selection phase AND we haven't already locked in a move.
  const isMyTurn = gameState && 
    (gameState.phase === 'OFFENSE_SELECT' || gameState.phase === 'DEFENSE_SELECT') &&
    !gameState.waitingForOpponent;

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. TOP HUD (Scoreboard placeholder) */}
      <View style={styles.hud}>
        <Text style={styles.hudText}>
          STATUS: {isConnected ? '🟢 ONLINE' : '🔴 OFFLINE'} 
        </Text>
        {gameState && (
           <Text style={styles.phaseText}>PHASE: {gameState.phase}</Text>
        )}
      </View>

      {/* 2. FIELD AREA (The Green Zone) */}
      <View style={styles.field}>
        {!gameState ? (
          // PRE-GAME STATE
          <View style={styles.centerBox}>
            <Text style={styles.title}>FootBored 5.1</Text>
            <Button title="Join Game" onPress={() => joinGame('TEST_ROOM')} />
          </View>
        ) : (
          // IN-GAME STATE
          <View style={styles.centerBox}>
            {gameState.waitingForOpponent ? (
              <Text style={styles.gameText}>⏳ Waiting for Opponent...</Text>
            ) : gameState.lastPlay ? (
              <View>
                <Text style={styles.resultTitle}>PREVIOUS PLAY</Text>
                <Text style={styles.gameText}>{gameState.lastPlay.message}</Text>
              </View>
            ) : (
              <Text style={styles.gameText}>Game Started! Pick a play.</Text>
            )}
          </View>
        )}
      </View>

      {/* 3. PLAYER HAND (The new component) */}
      {gameState && (
        <PlayerHand 
          hand={gameState.myState.hand} 
          onPlayCard={playCard}
          disabled={!isMyTurn}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  hud: {
    padding: 15,
    backgroundColor: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#555',
    alignItems: 'center',
  },
  hudText: { color: '#aaa', fontSize: 12, fontWeight: 'bold' },
  phaseText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  
  field: {
    flex: 1, // Takes all remaining space
    backgroundColor: '#2e7d32', // Grass Green
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerBox: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    alignItems: 'center',
  },
  title: { fontSize: 24, color: 'white', fontWeight: 'bold', marginBottom: 20 },
  gameText: { fontSize: 18, color: 'white', textAlign: 'center' },
  resultTitle: { color: '#f1c40f', fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
});