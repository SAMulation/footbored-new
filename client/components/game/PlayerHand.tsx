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
  mode?: 'bottom' | 'sidebar';
}

function getMiniCardTone(type: Card['type']) {
  if (type === 'SR' || type === 'LR') {
    return { backgroundColor: '#2d8f58', borderColor: '#64d596' };
  }
  if (type === 'SP' || type === 'LP') {
    return { backgroundColor: '#2f73a7', borderColor: '#77b9ea' };
  }
  return { backgroundColor: '#7f4f24', borderColor: '#f4d03f' };
}

export function PlayerHand({
  hand,
  onPlayCard,
  specialActions = [],
  disabled,
  bottomInset = 0,
  mode = 'bottom',
}: PlayerHandProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isSidebar = mode === 'sidebar';
  const isPhone = viewportWidth < 620 && !isSidebar;

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

  const sizeStyle = isSidebar
    ? {
      flex: 1,
      minHeight: 0,
      paddingBottom: 12,
    }
    : {
      minHeight: railBounds.minHeight,
      maxHeight: railBounds.maxHeight,
      paddingBottom: Math.max(12, Math.round(bottomInset) + 8),
    };

  const useWrappedActions = isPhone || isSidebar;

  return (
    <View
      style={[
        styles.container,
        isSidebar && styles.containerSidebar,
        sizeStyle,
        disabled && styles.containerDisabled,
      ]}>
      <View style={[styles.headerRow, isSidebar && styles.headerRowSidebar]}>
        <Text style={[styles.label, isPhone && styles.labelPhone, isSidebar && styles.labelSidebar]}>
          {isSidebar ? 'Play Calling' : 'Play Command Rail'}
        </Text>
        <Text style={[styles.subLabel, isPhone && styles.subLabelPhone]}>{disabled ? 'Awaiting turn' : 'Pick your play'}</Text>
      </View>

      {specialActions.length > 0 && (
        useWrappedActions ? (
          <View style={[styles.specialActionsWrap, isPhone && styles.specialActionsWrapPhone]}>
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
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.specialActionsRow}>
            {specialActions.map((action) => (
              <TouchableOpacity
                key={action.cardId}
                style={[
                  styles.specialActionButton,
                  !action.enabled && styles.specialActionButtonUnavailable,
                  (!action.enabled || disabled) && styles.specialActionDisabled,
                ]}
                onPress={() => onPlayCard(action.cardId)}
                disabled={disabled || !action.enabled}>
                <Text
                  style={[
                    styles.specialActionText,
                    !action.enabled && styles.specialActionTextUnavailable,
                  ]}
                  numberOfLines={1}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )
      )}

      {hand.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Waiting for next down...</Text>
        </View>
      ) : isSidebar ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarCardList}>
          {hand.map((card) => {
            const tone = getMiniCardTone(card.type);
            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.sidebarCardButton,
                  tone,
                  disabled && styles.specialActionDisabled,
                ]}
                onPress={() => onPlayCard(card.id)}
                disabled={disabled}>
                <Text style={styles.sidebarCardType}>{card.type}</Text>
                <Text style={styles.sidebarCardName} numberOfLines={1}>{card.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
  containerSidebar: {
    borderTopWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#3a4454',
    paddingTop: 8,
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
  headerRowSidebar: {
    alignItems: 'flex-end',
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
  labelSidebar: {
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
  specialActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
  specialActionsWrapPhone: {
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
    paddingVertical: 5,
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
  sidebarCardList: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  sidebarCardButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sidebarCardType: {
    color: '#f5fbff',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '900',
  },
  sidebarCardName: {
    color: '#f9feff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
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
