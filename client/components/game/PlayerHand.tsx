import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Card } from '../../../shared/types';
import { PlayCard } from './PlayCard';

export interface SpecialActionItem {
  cardId: string;
  label: string;
  enabled: boolean;
}

interface PlayerHandProps {
  hand: Card[];
  onPlayCard: (cardId: string) => void;
  specialActions?: SpecialActionItem[];
  disabled?: boolean;
}

export function PlayerHand({ hand, onPlayCard, specialActions = [], disabled }: PlayerHandProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const railHeight = useMemo(() => {
    if (viewportWidth >= 1500) return 300;
    if (viewportWidth >= 1300) return 276;
    if (viewportWidth >= 1100) return 250;
    if (viewportWidth >= 700) return 218;
    return 194;
  }, [viewportWidth]);
  const isPhone = viewportWidth < 520;

  return (
    <View style={[styles.container, { height: railHeight }, disabled && styles.containerDisabled]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, isPhone && styles.labelPhone]}>Play Command Rail</Text>
        <Text style={[styles.subLabel, isPhone && styles.subLabelPhone]}>{disabled ? 'Awaiting turn' : 'Pick your play'}</Text>
      </View>

      {specialActions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.specialActionsRow, isPhone && styles.specialActionsRowPhone]}>
          {specialActions.map((action) => (
            <TouchableOpacity
              key={action.cardId}
              style={[
                styles.specialActionButton,
                isPhone && styles.specialActionButtonPhone,
                !action.enabled && styles.specialActionButtonUnavailable,
                (!action.enabled || disabled) && styles.specialActionDisabled,
              ]}
              onPress={() => onPlayCard(action.cardId)}
              disabled={disabled || !action.enabled}>
              <Text
                style={[
                  styles.specialActionText,
                  isPhone && styles.specialActionTextPhone,
                  !action.enabled && styles.specialActionTextUnavailable,
                ]}
                numberOfLines={1}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {hand.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Waiting for next down...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}>
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
    width: '100%',
    backgroundColor: '#1a1d22',
    borderTopWidth: 2,
    borderTopColor: '#3a404a',
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },
  containerDisabled: {
    backgroundColor: '#171a1f',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  label: {
    color: '#d2d6dc',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelPhone: {
    fontSize: 11,
  },
  subLabel: {
    color: '#9ea5ad',
    fontSize: 12,
    fontWeight: '700',
  },
  subLabelPhone: {
    fontSize: 11,
  },
  specialActionsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  specialActionsRowPhone: {
    paddingHorizontal: 12,
    gap: 6,
  },
  specialActionButton: {
    backgroundColor: '#7f4f24',
    borderColor: '#f4d03f',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  specialActionButtonPhone: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  specialActionButtonUnavailable: {
    backgroundColor: '#3d2f27',
    borderColor: '#8d7a6b',
  },
  specialActionDisabled: {
    opacity: 0.45,
  },
  specialActionText: {
    color: '#fff4cc',
    fontSize: 12,
    fontWeight: '800',
  },
  specialActionTextPhone: {
    fontSize: 11,
  },
  specialActionTextUnavailable: {
    color: '#dccdbd',
  },
  cardsRow: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#656e79',
    fontStyle: 'italic',
    fontWeight: '600',
  },
});
