// client/App.tsx
import React from 'react';
import { StyleSheet, Text, View, Button, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useGameSocket } from './hooks/use-game-socket';

export default function App() {
  const { gameState, isConnected, joinGame, playCard } = useGameSocket();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FBG 5.1 Debugger</Text>
        <Text style={styles.status}>
          Status: {isConnected ? '🟢 Online' : '🔴 Offline'}
        </Text>
      </View>

      <View style={styles.actions}>
        {!gameState ? (
          <Button title="Join 'TEST_ROOM'" onPress={() => joinGame('TEST_ROOM')} />
        ) : (
          <View>
            <Text style={styles.phase}>Phase: {gameState.phase}</Text>
            
            {/* RENDER HAND BUTTONS (UGLY MODE) */}
            <Text style={styles.sectionTitle}>My Hand:</Text>
            <View style={styles.handContainer}>
              {gameState.myState.hand.map((card) => (
                <TouchableOpacity 
                  key={card.id} 
                  style={styles.cardButton} 
                  onPress={() => playCard(card.id)}
                >
                  <Text style={styles.cardText}>{card.name}</Text>
                  <Text style={styles.cardSub}>{card.type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {gameState.waitingForOpponent && (
              <Text style={styles.waiting}>⏳ Waiting for Opponent...</Text>
            )}
          </View>
        )}
      </View>

      <ScrollView style={styles.debugLog}>
        <Text style={styles.debugTitle}>RAW STATE DUMP:</Text>
        <Text style={styles.json}>
          {JSON.stringify(gameState, null, 2)}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#222', paddingTop: 40 },
  header: { padding: 20, borderBottomWidth: 1, borderColor: '#444' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  status: { color: '#aaa', marginTop: 5 },
  actions: { padding: 20, minHeight: 200 },
  phase: { color: '#4f9', fontSize: 18, marginBottom: 10, fontWeight: 'bold' },
  sectionTitle: { color: '#fff', marginTop: 10, marginBottom: 5 },
  handContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardButton: { 
    backgroundColor: '#3498db', 
    padding: 10, 
    borderRadius: 8, 
    minWidth: 80,
    alignItems: 'center'
  },
  cardText: { color: 'white', fontWeight: 'bold' },
  cardSub: { color: '#ddd', fontSize: 10 },
  waiting: { color: 'orange', marginTop: 10, fontStyle: 'italic' },
  debugLog: { flex: 1, backgroundColor: '#111', padding: 15 },
  debugTitle: { color: '#666', fontSize: 12, marginBottom: 5 },
  json: { color: '#0f0', fontFamily: 'monospace', fontSize: 10 }
});