// client/components/game/PlayerHand.tsx
import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { Card } from '../../../shared/types';
import { PlayCard } from './PlayCard';

interface PlayerHandProps {
  hand: Card[];
  onPlayCard: (cardId: string) => void;
  disabled?: boolean;
}

export function PlayerHand({ hand, onPlayCard, disabled }: PlayerHandProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Your Hand</Text>
      
      {hand.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Waiting for next down...</Text>
        </View>
      ) : (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {hand.map((card) => (
            <PlayCard
              key={card.id}
              card={card}
              onPress={() => onPlayCard(card.id)}
              disabled={disabled}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 190, // Fixed height at bottom of screen
    backgroundColor: '#222',
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 10,
    paddingBottom: 20, // Space for iPhone home bar
  },
  label: {
    color: '#aaa',
    marginLeft: 15,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scrollContent: {
    paddingHorizontal: 15, // Padding on left/right of the list
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#555',
    fontStyle: 'italic',
  }
});