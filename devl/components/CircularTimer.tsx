import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Vibration, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  /** 남은 시간 (초) */
  timeLeft: number;
  /** 총 시간 (초) */
  totalSeconds: number;
  /** 실행 중 여부 */
  isRunning: boolean;
  size?: number;
  strokeWidth?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const NORMAL_COLOR = '#1BAE74';
const URGENT_COLOR = '#FF3B30';
const TRACK_COLOR = '#F0F0F0';

export default function CircularTimer({
  timeLeft,
  totalSeconds,
  isRunning,
  size = 220,
  strokeWidth = 12,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, timeLeft / totalSeconds)) : 0;
  const isUrgent = timeLeft > 0 && timeLeft <= 10 && isRunning;

  // 프로그레스 바 업데이트 (부드럽게)
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // 마지막 10초: 펄스 + 진동
  useEffect(() => {
    if (!isUrgent) {
      pulseAnim.setValue(1);
      return;
    }
    // 펄스 애니메이션 (1초 주기)
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    pulse.start();

    // 매 초마다 짧은 진동
    const vibrateInterval = setInterval(() => {
      if (Platform.OS === 'ios') {
        Vibration.vibrate(50);
      } else {
        Vibration.vibrate(80);
      }
    }, 1000);

    return () => {
      pulse.stop();
      clearInterval(vibrateInterval);
    };
  }, [isUrgent]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-circumference, 0],
  });

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const color = isUrgent ? URGENT_COLOR : NORMAL_COLOR;

  return (
    <Animated.View style={[styles.container, { width: size, height: size, transform: [{ scale: pulseAnim }] }]}>
      <Svg width={size} height={size}>
        {/* 배경 트랙 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TRACK_COLOR}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* 프로그레스 — 시계방향으로 줄어들도록 rotate + scale로 방향 반전 */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* 시간 텍스트 */}
      <View style={[styles.textContainer, { width: size, height: size }]}>
        <Text style={[styles.timeText, { color }]}>{timeStr}</Text>
        {isUrgent && <Text style={styles.urgentLabel}>곧 완료!</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  urgentLabel: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '700',
    marginTop: 4,
  },
});
