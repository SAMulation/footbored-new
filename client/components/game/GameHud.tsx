import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { GamePhase } from '../../../shared/types';

interface GameHudProps {
  homeScore: number;
  awayScore: number;
  quarter: number;
  clockSeconds: number;
  down: number;
  toGo: number;
  possession: 'home' | 'away';
  isConnected: boolean;
  isRejoining: boolean;
  phase: GamePhase | null;
  waitingForOpponent: boolean;
  isMyTurn: boolean;
  homeTimeouts: number;
  awayTimeouts: number;
  homeDeckCount: number;
  awayDeckCount: number;
}

function formatClock(clockSeconds: number): string {
  const safe = Math.max(0, clockSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDown(down: number): string {
  if (down === 1) return '1st';
  if (down === 2) return '2nd';
  if (down === 3) return '3rd';
  if (down === 4) return '4th';
  return `${down}th`;
}

function formatPhase(phase: GamePhase | null): string {
  if (phase === GamePhase.COIN_TOSS) return 'COIN TOSS';
  if (phase === GamePhase.OFFENSE_SELECT) return 'OFFENSE CALL';
  if (phase === GamePhase.DEFENSE_SELECT) return 'DEFENSE CALL';
  if (phase === GamePhase.CONVERSION_OFFENSE_SELECT) return 'CONVERSION CALL';
  if (phase === GamePhase.CONVERSION_DEFENSE_SELECT) return 'CONVERSION DEFENSE';
  if (phase === GamePhase.CONVERSION_RESOLUTION) return 'CONVERSION RESULT';
  if (phase === GamePhase.RESOLUTION) return 'RESOLUTION';
  if (phase === GamePhase.GAME_OVER) return 'GAME OVER';
  if (phase === GamePhase.LOBBY) return 'LOBBY';
  return 'READY';
}

function resolvePrompt({
  isRejoining,
  waitingForOpponent,
  phase,
  isMyTurn,
}: {
  isRejoining: boolean;
  waitingForOpponent: boolean;
  phase: GamePhase | null;
  isMyTurn: boolean;
}): string {
  if (isRejoining) return 'Reconnecting to room...';
  if (waitingForOpponent) return 'Waiting for opponent pick';
  if (phase === GamePhase.OFFENSE_SELECT || phase === GamePhase.DEFENSE_SELECT) {
    return isMyTurn ? 'Pick your play' : 'Opponent selecting';
  }
  if (phase === GamePhase.CONVERSION_OFFENSE_SELECT) {
    return isMyTurn ? 'Choose XP or 2PT' : 'Opponent choosing conversion';
  }
  if (phase === GamePhase.CONVERSION_DEFENSE_SELECT) {
    return isMyTurn ? 'Pick conversion play' : 'Opponent setting conversion defense';
  }
  if (phase === GamePhase.CONVERSION_RESOLUTION) return 'Resolving conversion';
  if (phase === GamePhase.RESOLUTION) return 'Resolving current play';
  if (phase === GamePhase.GAME_OVER) return 'Final whistle';
  if (phase === GamePhase.COIN_TOSS) return 'Coin toss in progress';
  return 'Ready for kickoff';
}

export function GameHud({
  homeScore,
  awayScore,
  quarter,
  clockSeconds,
  down,
  toGo,
  possession,
  isConnected,
  isRejoining,
  phase,
  waitingForOpponent,
  isMyTurn,
  homeTimeouts,
  awayTimeouts,
  homeDeckCount,
  awayDeckCount,
}: GameHudProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const isPhone = viewportWidth < 680;
  const isTablet = viewportWidth >= 680 && viewportWidth < 1120;

  const connectionLabel = isRejoining ? 'REJOINING' : isConnected ? 'ONLINE' : 'OFFLINE';
  const prompt = resolvePrompt({ isRejoining, waitingForOpponent, phase, isMyTurn });

  return (
    <View style={[styles.container, isPhone && styles.containerPhone]}>
      <View style={[styles.statusRow, isPhone && styles.statusRowPhone]}>
        <View
          style={[
            styles.connectionPill,
            isConnected && !isRejoining ? styles.connectionOnline : styles.connectionOffline,
          ]}>
          <Text style={styles.connectionText}>{connectionLabel}</Text>
        </View>

        <Text style={styles.phaseBadge}>{formatPhase(phase)}</Text>

        <View style={styles.clockBlock}>
          <Text style={styles.clockText}>Q{quarter} {formatClock(clockSeconds)}</Text>
          <Text style={styles.downText}>{formatDown(down)} & {toGo}</Text>
        </View>
      </View>

      <View style={[styles.scoreboardRow, (isPhone || isTablet) && styles.scoreboardRowStack]}>
        <View style={[styles.teamBlock, possession === 'home' && styles.teamBlockPossession]}>
          <Text style={styles.teamLabel}>HOME</Text>
          <Text style={styles.teamSub}>TO {homeTimeouts} / DECK {homeDeckCount}</Text>
        </View>

        <View style={[styles.scoreBlock, isPhone && styles.scoreBlockPhone]}>
          <Text style={[styles.scoreText, isPhone && styles.scoreTextPhone]}>
            {homeScore} - {awayScore}
          </Text>
          <Text style={styles.scoreSub}>HOME vs AWAY</Text>
        </View>

        <View style={[styles.teamBlock, possession === 'away' && styles.teamBlockPossession]}>
          <Text style={styles.teamLabel}>AWAY</Text>
          <Text style={styles.teamSub}>TO {awayTimeouts} / DECK {awayDeckCount}</Text>
        </View>
      </View>

      <View style={styles.promptRow}>
        <Text style={styles.promptText}>{prompt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#171b22',
    borderBottomColor: '#34404e',
    borderBottomWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  containerPhone: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusRowPhone: {
    flexWrap: 'wrap',
  },
  connectionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
  },
  connectionOnline: {
    backgroundColor: '#1f6e3d',
    borderColor: '#59d38f',
  },
  connectionOffline: {
    backgroundColor: '#5a2323',
    borderColor: '#e67f7f',
  },
  connectionText: {
    color: '#f4f8f4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  phaseBadge: {
    color: '#1f1600',
    backgroundColor: '#f4d03f',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  clockBlock: {
    backgroundColor: '#252d38',
    borderWidth: 1,
    borderColor: '#4b5666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 118,
    alignItems: 'flex-end',
  },
  clockText: {
    color: '#f4d03f',
    fontSize: 13,
    fontWeight: '900',
  },
  downText: {
    color: '#d7e5d8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  scoreboardRowStack: {
    flexDirection: 'column',
  },
  teamBlock: {
    flex: 1,
    backgroundColor: '#17472a',
    borderWidth: 1,
    borderColor: '#2f8550',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  teamBlockPossession: {
    borderColor: '#f4d03f',
    borderWidth: 2,
  },
  teamLabel: {
    color: '#c7e6ca',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  teamSub: {
    color: '#f2fff2',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  scoreBlock: {
    minWidth: 220,
    backgroundColor: '#232a34',
    borderColor: '#4a5668',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreBlockPhone: {
    minWidth: 0,
    width: '100%',
  },
  scoreText: {
    color: '#f7fbff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0.4,
    lineHeight: 42,
  },
  scoreTextPhone: {
    fontSize: 30,
    lineHeight: 34,
  },
  scoreSub: {
    color: '#b9c8db',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  promptRow: {
    backgroundColor: '#1f2530',
    borderWidth: 1,
    borderColor: '#374150',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  promptText: {
    color: '#edf5ee',
    fontSize: 14,
    fontWeight: '700',
  },
});
