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
  bottomInset?: number;
}

export function PlayerHand({ hand, onPlayCard, specialActions = [], disabled, bottomInset = 0 }: PlayerHandProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const railBounds = useMemo(() => {
    let minHeight = 186;
    let maxHeight = 286;

    if (viewportWidth >= 1500) {
      minHeight = 212;
      maxHeight = 334;
    } else if (viewportWidth >= 1300) {
      minHeight = 204;
      maxHeight = 320;
    } else if (viewportWidth >= 1100) {
      minHeight = 194;
      maxHeight = 302;
    } else if (viewportWidth >= 700) {
      minHeight = 188;
      maxHeight = 292;
    }

    if (viewportHeight < 860) {
      minHeight -= 10;
      maxHeight -= 22;
    }
    if (viewportHeight < 760) {
      minHeight -= 10;
      maxHeight -= 24;
    }

    return {
      minHeight: Math.max(172, minHeight),
      maxHeight: Math.max(244, maxHeight),
    };
  }, [viewportWidth, viewportHeight]);

  const isPhone = viewportWidth < 520;

  return (
    <View
      style={[
        styles.container,
        {
          minHeight: railBounds.minHeight,
          maxHeight: railBounds.maxHeight,
          paddingBottom: Math.max(12, Math.round(bottomInset) + 8),
        },
        disabled && styles.containerDisabled,
      ]}>
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
    backgroundColor: '#171b22',
    borderTopWidth: 2,
    borderTopColor: '#3a4454',
    paddingTop: 10,
    gap: 10,
  },
  containerDisabled: {
    backgroundColor: '#151920',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
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
    paddingBottom: 6,
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
