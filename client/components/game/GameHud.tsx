import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  const connectionLabel = isRejoining ? 'REJOINING' : isConnected ? 'ONLINE' : 'OFFLINE';
  const prompt = resolvePrompt({ isRejoining, waitingForOpponent, phase, isMyTurn });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View
          style={[
            styles.connectionPill,
            isConnected && !isRejoining ? styles.connectionOnline : styles.connectionOffline,
          ]}>
          <Text style={styles.connectionText}>{connectionLabel}</Text>
        </View>

        <View style={styles.scoreBlock}>
          <Text style={styles.scoreText}>HOME {homeScore} - {awayScore} AWAY</Text>
        </View>

        <View style={styles.clockBlock}>
          <Text style={styles.clockText}>Q{quarter} {formatClock(clockSeconds)}</Text>
          <Text style={styles.downText}>{formatDown(down)} & {toGo}</Text>
        </View>
      </View>

      <View style={styles.midRow}>
        <View style={styles.statChip}>
          <Text style={styles.statLabel}>POSS</Text>
          <Text style={styles.statValue}>{possession.toUpperCase()}</Text>
        </View>

        <View style={styles.statChip}>
          <Text style={styles.statLabel}>HOME TO / DECK</Text>
          <Text style={styles.statValue}>{homeTimeouts} / {homeDeckCount}</Text>
        </View>

        <View style={styles.statChip}>
          <Text style={styles.statLabel}>AWAY TO / DECK</Text>
          <Text style={styles.statValue}>{awayTimeouts} / {awayDeckCount}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.phaseBadge}>{formatPhase(phase)}</Text>
        <Text style={styles.promptText}>{prompt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1f2328',
    borderBottomColor: '#3d434d',
    borderBottomWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    minWidth: 92,
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
  scoreBlock: {
    flex: 1,
    backgroundColor: '#2a3038',
    borderWidth: 1,
    borderColor: '#4b515d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  scoreText: {
    color: '#f8fbff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  clockBlock: {
    minWidth: 132,
    backgroundColor: '#2a3038',
    borderWidth: 1,
    borderColor: '#4b515d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  clockText: {
    color: '#f4d03f',
    fontSize: 13,
    fontWeight: '800',
  },
  downText: {
    color: '#d7e5d8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  midRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: '#1a4b2a',
    borderWidth: 1,
    borderColor: '#2d7843',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statLabel: {
    color: '#bcd6bf',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statValue: {
    color: '#f5fff6',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  promptText: {
    flex: 1,
    color: '#f2f7f2',
    fontSize: 13,
    fontWeight: '700',
  },
});
