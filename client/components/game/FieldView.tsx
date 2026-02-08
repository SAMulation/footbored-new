import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface FieldViewProps {
  ballOn: number;
  toGo: number;
  offenseSide: 'home' | 'away';
  animate?: boolean;
}

const BALL_SIZE = 18;

function clampToField(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function FieldView({ ballOn, toGo, offenseSide, animate = true }: FieldViewProps) {
  const { width: viewportWidth } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWide = viewportWidth >= 1500;
  const isDesktop = viewportWidth >= 1100;
  const isTablet = viewportWidth >= 700 && viewportWidth < 1100;
  const isPhone = viewportWidth < 520;

  const trackWidth = useMemo(() => {
    const widthPct = isWeb
      ? (isDesktopWide ? 0.78 : isDesktop ? 0.84 : isTablet ? 0.9 : 0.94)
      : 0.9;
    const raw = viewportWidth * widthPct;
    return Math.max(isPhone ? 256 : 320, Math.min(isDesktopWide ? 1060 : 980, Math.round(raw)));
  }, [isDesktop, isDesktopWide, isPhone, isTablet, isWeb, viewportWidth]);

  const trackHeight = isWeb ? (isDesktop ? 192 : isTablet ? 158 : 130) : 134;
  const endZoneWidth = Math.max(24, Math.round(trackWidth * 0.08));

  const safeBallOn = clampToField(ballOn);
  const firstDownSpot = useMemo(() => {
    const raw = offenseSide === 'home' ? safeBallOn + toGo : safeBallOn - toGo;
    return clampToField(raw);
  }, [offenseSide, safeBallOn, toGo]);

  const ballX = useRef(new Animated.Value((safeBallOn / 100) * trackWidth)).current;

  useEffect(() => {
    const target = (safeBallOn / 100) * trackWidth;
    if (!animate) {
      ballX.setValue(target);
      return;
    }

    Animated.timing(ballX, {
      toValue: target,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [animate, ballX, safeBallOn, trackWidth]);

  const lineOfScrimmageLeft = (safeBallOn / 100) * trackWidth;
  const firstDownLeft = (firstDownSpot / 100) * trackWidth;
  const offenseDirectionLabel = offenseSide === 'home'
    ? (isPhone ? 'HOME ->' : 'Home driving ->')
    : (isPhone ? 'AWAY <-' : 'Away driving <-');
  const majorYards = Array.from({ length: 11 }, (_, idx) => idx * 10);
  const hashYards = Array.from({ length: 21 }, (_, idx) => idx * 5);
  const yardNumberLabels = trackWidth < 420
    ? ['10', '30', '50', '30', '10']
    : ['10', '20', '30', '40', '50', '40', '30', '20', '10'];
  const yardNumberPositions = trackWidth < 420
    ? [12, 32, 50, 68, 88]
    : [10, 20, 30, 40, 50, 60, 70, 80, 90];

  return (
    <View style={styles.container}>
      <View style={[styles.track, { width: trackWidth, height: trackHeight }]}>
        <View style={[styles.endZone, styles.endZoneLeft, { width: endZoneWidth }]} />
        <View style={[styles.endZone, styles.endZoneRight, { width: endZoneWidth }]} />

        {majorYards.map((yard) => {
          const left = Math.max(0, Math.min(trackWidth - 1, (yard / 100) * trackWidth));
          return <View key={`major-${yard}`} style={[styles.majorLine, { left }]} />;
        })}

        {hashYards.map((yard) => {
          const left = Math.max(0, Math.min(trackWidth - 2, (yard / 100) * trackWidth));
          return (
            <React.Fragment key={`hash-${yard}`}>
              <View style={[styles.hashMark, { left, top: trackHeight * 0.24 }]} />
              <View style={[styles.hashMark, { left, bottom: trackHeight * 0.24 }]} />
            </React.Fragment>
          );
        })}

        <View style={[styles.lineOfScrimmage, { left: lineOfScrimmageLeft }]} />
        <View style={[styles.firstDownLine, { left: firstDownLeft }]} />

        <Animated.View
          style={[
            styles.ballMarker,
            {
              left: -(BALL_SIZE / 2),
              top: (trackHeight - BALL_SIZE) / 2,
              transform: [{ translateX: ballX }],
            },
          ]}>
          <View style={styles.ball}>
            <View style={styles.ballLaces} />
          </View>
        </Animated.View>
      </View>

      <View style={[styles.yardNumberRow, { width: trackWidth }]}>
        {yardNumberLabels.map((label, idx) => (
          <Text
            key={`yard-number-${label}-${idx}`}
            style={[
              styles.yardNumber,
              isPhone && styles.yardNumberPhone,
              {
                left: `${yardNumberPositions[idx]}%`,
              },
            ]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={[styles.metaRow, { width: trackWidth }]}>
        <Text style={[styles.metaText, isPhone && styles.metaTextPhone]}>Ball on {safeBallOn}</Text>
        <Text style={[styles.metaText, isPhone && styles.metaTextPhone]}>Line to gain {firstDownSpot}</Text>
        <Text style={[styles.metaText, isPhone && styles.metaTextPhone]}>{offenseDirectionLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  track: {
    backgroundColor: '#2f7d35',
    borderColor: '#1d5d24',
    borderWidth: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  endZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 43, 12, 0.38)',
  },
  endZoneLeft: {
    left: 0,
  },
  endZoneRight: {
    right: 0,
  },
  majorLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.33)',
  },
  hashMark: {
    position: 'absolute',
    width: 2,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  lineOfScrimmage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#f4f4f4',
    opacity: 0.9,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: '#8d5524',
    borderColor: '#ffffff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballLaces: {
    width: BALL_SIZE / 2.4,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  yardNumberRow: {
    height: 16,
    position: 'relative',
  },
  yardNumber: {
    position: 'absolute',
    transform: [{ translateX: -10 }],
    color: '#d8edd8',
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.9,
  },
  yardNumberPhone: {
    transform: [{ translateX: -8 }],
    fontSize: 9,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  metaText: {
    color: '#deefd9',
    fontSize: 13,
    fontWeight: '700',
  },
  metaTextPhone: {
    fontSize: 10,
  },
});
