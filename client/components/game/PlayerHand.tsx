import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Card } from '../../../shared/types';
import { PlayCard } from './PlayCard';

export type SpecialActionCategory = 'conversion' | 'special' | 'clock';
export type SpecialActionStatus = 'ready' | 'locked' | 'blocked';

export interface SpecialActionItem {
  cardId: string;
  label: string;
  enabled: boolean;
  category: SpecialActionCategory;
  status: SpecialActionStatus;
  reasonText?: string;
  recommended?: boolean;
}

interface PlayerHandProps {
  hand: Card[];
  onPlayCard: (cardId: string) => void;
  specialActions?: SpecialActionItem[];
  disabled?: boolean;
  disabledReason?: string;
  bottomInset?: number;
  mode?: 'bottom' | 'sidebar';
  recommendedCardId?: string | null;
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

function resolveButtonStyle(status: SpecialActionStatus) {
  if (status === 'ready') {
    return {
      button: styles.specialActionButtonReady,
      text: styles.specialActionTextReady,
    };
  }
  if (status === 'locked') {
    return {
      button: styles.specialActionButtonLocked,
      text: styles.specialActionTextLocked,
    };
  }
  return {
    button: styles.specialActionButtonBlocked,
    text: styles.specialActionTextBlocked,
  };
}

export function PlayerHand({
  hand,
  onPlayCard,
  specialActions = [],
  disabled,
  disabledReason,
  bottomInset = 0,
  mode = 'bottom',
  recommendedCardId = null,
}: PlayerHandProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isSidebar = mode === 'sidebar';
  const isPhone = viewportWidth < 620 && !isSidebar;
  const [specialsCollapsed, setSpecialsCollapsed] = useState(false);

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

  const conversionActions = specialActions.filter((action) => action.category === 'conversion');
  const coreSpecialActions = specialActions.filter((action) => action.category === 'special');
  const clockActions = specialActions.filter((action) => action.category === 'clock');

  const renderActionChip = (action: SpecialActionItem, isCarousel = false) => {
    const buttonStatus: SpecialActionStatus = disabled ? 'blocked' : action.status;
    const tone = resolveButtonStyle(buttonStatus);
    const reasonLabel = buttonStatus === 'ready' ? null : action.reasonText ?? disabledReason ?? 'Unavailable';

    return (
      <TouchableOpacity
        key={action.cardId}
        style={[
          styles.specialActionButton,
          tone.button,
          isCarousel && styles.specialActionButtonCarousel,
          action.recommended && styles.specialActionButtonRecommended,
        ]}
        onPress={() => onPlayCard(action.cardId)}
        disabled={disabled || !action.enabled}>
        <Text style={[styles.specialActionText, tone.text]} numberOfLines={1}>
          {action.recommended ? '★ ' : ''}
          {action.label}
        </Text>
        {reasonLabel && (
          <Text style={styles.specialActionReason} numberOfLines={1}>
            {reasonLabel}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    actions: SpecialActionItem[],
    opts?: { collapsible?: boolean; collapsed?: boolean; onToggle?: () => void },
  ) => {
    if (actions.length === 0) {
      return null;
    }

    const isCollapsed = !!opts?.collapsed;

    return (
      <View style={styles.sidebarSection}>
        <View style={styles.sidebarSectionHeader}>
          <Text style={styles.sidebarSectionTitle}>{title}</Text>
          {opts?.collapsible ? (
            <TouchableOpacity onPress={opts.onToggle} style={styles.sectionToggle}>
              <Text style={styles.sectionToggleText}>{isCollapsed ? 'Show' : 'Hide'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {!isCollapsed && <View style={styles.sidebarActionWrap}>{actions.map((action) => renderActionChip(action))}</View>}
      </View>
    );
  };

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
        <Text style={[styles.subLabel, isPhone && styles.subLabelPhone]}>
          {disabledReason ?? (disabled ? 'Awaiting turn' : 'Pick your play')}
        </Text>
      </View>

      {specialActions.length > 0 && (
        isSidebar ? (
          <View style={styles.sidebarSectionsContainer}>
            {renderSection('Conversion', conversionActions)}
            {renderSection('Specials', coreSpecialActions, {
              collapsible: true,
              collapsed: specialsCollapsed,
              onToggle: () => setSpecialsCollapsed((current) => !current),
            })}
            {renderSection('Clock', clockActions)}
          </View>
        ) : isPhone ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={156}
            snapToAlignment="start"
            contentContainerStyle={styles.specialActionsCarouselTrack}>
            {specialActions.map((action) => renderActionChip(action, true))}
          </ScrollView>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.specialActionsRow}>
            {specialActions.map((action) => renderActionChip(action))}
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
            const isRecommended = card.id === recommendedCardId;

            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.sidebarCardButton,
                  tone,
                  disabled && styles.specialActionDisabled,
                  isRecommended && styles.sidebarCardRecommended,
                ]}
                onPress={() => onPlayCard(card.id)}
                disabled={disabled}>
                <Text style={styles.sidebarCardType}>{card.type}</Text>
                <Text style={styles.sidebarCardName} numberOfLines={1}>{card.name}</Text>
                {isRecommended ? <Text style={styles.sidebarRecommendedText}>REC</Text> : null}
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
              isRecommended={card.id === recommendedCardId}
              compact={isPhone}
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
    textTransform: 'capitalize',
  },
  subLabelPhone: {
    fontSize: 11,
  },
  sidebarSectionsContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  sidebarSection: {
    borderWidth: 1,
    borderColor: '#2d3645',
    backgroundColor: '#1a202b',
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarSectionTitle: {
    color: '#c9d3e0',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionToggle: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#4f6078',
    backgroundColor: '#293245',
  },
  sectionToggleText: {
    color: '#dfe7f4',
    fontSize: 11,
    fontWeight: '700',
  },
  sidebarActionWrap: {
    gap: 6,
  },
  specialActionsRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  specialActionsCarouselTrack: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 2,
  },
  specialActionButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    minWidth: 118,
    gap: 2,
  },
  specialActionButtonCarousel: {
    width: 148,
    paddingVertical: 8,
  },
  specialActionButtonReady: {
    backgroundColor: '#204631',
    borderColor: '#6fdea4',
  },
  specialActionButtonLocked: {
    backgroundColor: '#4c371b',
    borderColor: '#f2ca64',
  },
  specialActionButtonBlocked: {
    backgroundColor: '#323943',
    borderColor: '#5d6673',
    opacity: 0.9,
  },
  specialActionButtonRecommended: {
    borderColor: '#f4d03f',
    borderWidth: 2,
  },
  specialActionDisabled: {
    opacity: 0.5,
  },
  specialActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  specialActionTextReady: {
    color: '#eafff1',
  },
  specialActionTextLocked: {
    color: '#fff0c7',
  },
  specialActionTextBlocked: {
    color: '#d5dbe3',
  },
  specialActionReason: {
    color: '#aeb6c2',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
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
  sidebarCardRecommended: {
    borderColor: '#f4d03f',
    borderWidth: 2,
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
  sidebarRecommendedText: {
    color: '#201700',
    backgroundColor: '#f4d03f',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
    fontSize: 10,
    fontWeight: '900',
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
