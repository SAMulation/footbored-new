import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface FieldViewProps {
  ballOn: number;
  toGo: number;
  offenseSide: 'home' | 'away';
  animate?: boolean;
}

const TRACK_WIDTH = 300;
const MARKER_OFFSET = 8;

function clampToField(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function FieldView({ ballOn, toGo, offenseSide, animate = true }: FieldViewProps) {
  const safeBallOn = clampToField(ballOn);
  const firstDownSpot = useMemo(() => {
    const raw = offenseSide === 'home' ? safeBallOn + toGo : safeBallOn - toGo;
    return clampToField(raw);
  }, [offenseSide, safeBallOn, toGo]);

  const ballX = useRef(new Animated.Value((safeBallOn / 100) * TRACK_WIDTH)).current;

  useEffect(() => {
    const target = (safeBallOn / 100) * TRACK_WIDTH;
    if (!animate) {
      ballX.setValue(target);
      return;
    }

    Animated.timing(ballX, {
      toValue: target,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [animate, ballX, safeBallOn]);

  const firstDownLeft = (firstDownSpot / 100) * TRACK_WIDTH;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <View style={styles.hashRow}>
          {Array.from({ length: 11 }).map((_, idx) => (
            <View key={`hash-${idx}`} style={styles.hash} />
          ))}
        </View>

        <View style={[styles.firstDownLine, { left: firstDownLeft }]} />

        <Animated.View style={[styles.ballMarker, { transform: [{ translateX: ballX }] }]}>
          <View style={styles.ball} />
        </Animated.View>
      </View>

      <View style={styles.labels}>
        <Text style={styles.labelText}>Ball: {safeBallOn}</Text>
        <Text style={styles.labelText}>1st: {firstDownSpot}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  track: {
    width: TRACK_WIDTH,
    height: 110,
    backgroundColor: '#2e7d32',
    borderColor: '#1b5e20',
    borderWidth: 2,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  hashRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  hash: {
    width: 2,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  firstDownLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#f1c40f',
  },
  ballMarker: {
    position: 'absolute',
    left: -MARKER_OFFSET,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  ball: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8d5524',
    borderColor: '#fff',
    borderWidth: 2,
  },
  labels: {
    marginTop: 10,
    width: TRACK_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    color: '#d7f7d8',
    fontSize: 12,
    fontWeight: '700',
  },
});
