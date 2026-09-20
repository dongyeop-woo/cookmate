import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Vibration, Platform } from 'react-native';

interface Props {
  /** 남은 시간 (초) */
  timeLeft: number;
  /** 총 시간 (초) */
  totalSeconds: number;
  /** 실행 중 여부 */
  isRunning: boolean;
  /** 작은 화면용 컴팩트 모드 (SE 등) */
  compact?: boolean;
}

const NORMAL_COLOR = '#1BAE74';
const URGENT_COLOR = '#FF3B30';
const TRACK_COLOR = '#E9ECEF';

const formatTotal = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0 && sec > 0) return `${m}분 ${sec}초`;
  if (m > 0) return `${m}분`;
  return `${sec}초`;
};

export default function FlatTimer({ timeLeft, totalSeconds, isRunning, compact = false }: Props) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 경과 비율 (0 → 1)
  const elapsed = totalSeconds > 0 ? Math.max(0, Math.min(1, 1 - timeLeft / totalSeconds)) : 0;
  // 10초 이하 = 긴급 (빨간색). 펄스/진동은 실행 중일 때만.
  const isUrgent = timeLeft > 0 && timeLeft <= 10;
  const isUrgentActive = isUrgent && isRunning;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: elapsed,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [elapsed]);

  useEffect(() => {
    if (!isUrgentActive) {
      pulseAnim.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulse.start();
    const vibrateInterval = setInterval(() => {
      Vibration.vibrate(Platform.OS === 'ios' ? 50 : 80);
    }, 1000);
    return () => {
      pulse.stop();
      clearInterval(vibrateInterval);
    };
  }, [isUrgentActive]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const color = isUrgent ? URGENT_COLOR : NORMAL_COLOR;

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[
          styles.timeText,
          compact && styles.timeTextCompact,
          { color, transform: [{ scale: pulseAnim }] },
        ]}
      >
        {timeStr}
      </Animated.Text>
      <Text style={[styles.totalText, compact && styles.totalTextCompact]}>{formatTotal(totalSeconds)}</Text>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: color,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>
      {isUrgent && <Text style={styles.urgentLabel}>곧 완료!</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  timeText: {
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 84,
  },
  timeTextCompact: {
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -1.5,
  },
  totalText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 18,
  },
  totalTextCompact: {
    fontSize: 13,
    marginBottom: 10,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: TRACK_COLOR,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  urgentLabel: {
    fontSize: 13,
    color: URGENT_COLOR,
    fontWeight: '700',
    marginTop: 10,
  },
});
