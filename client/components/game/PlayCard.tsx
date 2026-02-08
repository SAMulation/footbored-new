// client/components/game/PlayCard.tsx
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Card } from '../../../shared/types';

interface PlayCardProps {
  card: Card;
  onPress: () => void;
  disabled?: boolean;
}

function getCardColor(type: Card['type']) {
  const isRun = type === 'SR' || type === 'LR';
  const isPass = type === 'SP' || type === 'LP';
  return isRun ? '#27ae60' : isPass ? '#2980b9' : '#f39c12';
}

function getCardIcon(type: Card['type']): React.ComponentProps<typeof MaterialIcons>['name'] {
  const isRun = type === 'SR' || type === 'LR';
  const isPass = type === 'SP' || type === 'LP';
  if (isRun) return 'arrow-forward';
  if (isPass) return 'arrow-upward';
  return 'star';
}

export function PlayCard({ card, onPress, disabled = false }: PlayCardProps) {
  const backgroundColor = getCardColor(card.type);
  const iconName = getCardIcon(card.type);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor, opacity: disabled ? 0.6 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${card.name} (${card.type})`}
    >
      <View style={styles.header}>
        <Text style={styles.abrv}>{card.type}</Text>
        <Text style={styles.cost}>1</Text>
      </View>

      <View style={styles.body}>
        <MaterialIcons name={iconName} size={40} color="white" />
      </View>

      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>
          {card.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 100,
    height: 140,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
    marginRight: 10,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  abrv: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  cost: { color: 'white', fontSize: 14 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { backgroundColor: 'white', paddingVertical: 6, alignItems: 'center', paddingHorizontal: 6 },
  name: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
});
