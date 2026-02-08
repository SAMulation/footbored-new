import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  return isRun ? '#27ae60' : isPass ? '#2980b9' : '#d18f1f';
}

function getCardIcon(type: Card['type']): React.ComponentProps<typeof MaterialIcons>['name'] {
  const isRun = type === 'SR' || type === 'LR';
  const isPass = type === 'SP' || type === 'LP';
  if (isRun) return 'arrow-forward';
  if (isPass) return 'arrow-upward';
  return 'star';
}

function getCardFamily(type: Card['type']): string {
  if (type === 'SR' || type === 'LR') return 'RUN';
  if (type === 'SP' || type === 'LP') return 'PASS';
  return 'SPECIAL';
}

export function PlayCard({ card, onPress, disabled = false }: PlayCardProps) {
  const backgroundColor = getCardColor(card.type);
  const iconName = getCardIcon(card.type);
  const familyLabel = getCardFamily(card.type);
  const { width: viewportWidth } = useWindowDimensions();

  const size = useMemo(() => {
    if (viewportWidth >= 1500) {
      return { width: 150, height: 198, icon: 58, name: 14 };
    }
    if (viewportWidth >= 1300) {
      return { width: 134, height: 182, icon: 52, name: 13 };
    }
    if (viewportWidth >= 1100) {
      return { width: 120, height: 168, icon: 46, name: 12 };
    }
    if (viewportWidth >= 700) {
      return { width: 106, height: 146, icon: 40, name: 12 };
    }
    return { width: 94, height: 130, icon: 34, name: 11 };
  }, [viewportWidth]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor,
          width: size.width,
          height: size.height,
        },
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${card.name} (${card.type})`}>
      <View style={styles.header}>
        <Text style={styles.typeChip}>{card.type}</Text>
        <Text style={styles.costText}>1</Text>
      </View>

      <View style={styles.body}>
        <MaterialIcons name={iconName} size={size.icon} color="#ffffff" />
        <Text style={styles.familyText}>{familyLabel}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.name, { fontSize: size.name }]} numberOfLines={2}>
          {card.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#f5f5f5',
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 4,
    elevation: 4,
  },
  cardPressed: {
    transform: [{ translateY: 1 }],
    shadowOpacity: 0.12,
  },
  cardDisabled: {
    opacity: 0.58,
    borderColor: '#b5b8bb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  typeChip: {
    color: '#0f1318',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '900',
  },
  costText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  familyText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  footer: {
    backgroundColor: '#f2f4f6',
    borderTopColor: 'rgba(0,0,0,0.2)',
    borderTopWidth: 1,
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: '#2b2f34',
    fontWeight: '900',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 13,
  },
});
