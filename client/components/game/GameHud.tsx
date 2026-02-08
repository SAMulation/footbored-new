import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface GameHudProps {
  homeScore: number;
  awayScore: number;
  quarter: number;
  clockSeconds: number;
  down: number;
  toGo: number;
  possession: 'home' | 'away';
  isConnected: boolean;
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
  return '4th';
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
}: GameHudProps) {
  return (
    <View style={styles.container}>
      <View style={styles.rowTop}>
        <Text style={styles.status}>{isConnected ? 'ONLINE' : 'OFFLINE'}</Text>
        <Text style={styles.score}>HOME {homeScore} - {awayScore} AWAY</Text>
        <Text style={styles.meta}>Q{quarter} {formatClock(clockSeconds)}</Text>
      </View>

      <View style={styles.rowBottom}>
        <Text style={styles.context}>POSS: {possession.toUpperCase()}</Text>
        <Text style={styles.context}>{formatDown(down)} & {toGo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderBottomColor: '#555',
    borderBottomWidth: 2,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowBottom: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  status: {
    color: '#9ad4ff',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 52,
  },
  score: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    color: '#f1c40f',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 74,
    textAlign: 'right',
  },
  context: {
    color: '#d6d6d6',
    fontSize: 13,
    fontWeight: '700',
  },
});
