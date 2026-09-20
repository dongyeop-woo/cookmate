import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

/**
 * 출석체크 포인트 계산.
 * - 기본: 3 + streak 포인트 (day 1=4P, day 3=6P, day 7=10P)
 * - 7일마다: +40P 보너스
 */
export function calculateAttendancePoints(streak: number): { base: number; bonus: number } {
  const base = 3 + streak;
  const bonus = streak > 0 && streak % 7 === 0 ? 40 : 0;
  return { base, bonus };
}

interface Props {
  visible: boolean;
  onAutoDismiss: () => void;
  streak: number;
  earnedPoints: number;
  bonusPoints?: number;
}

const DISPLAY_MS = 3000;

export default function AttendanceToast({ visible, onAutoDismiss, streak, earnedPoints, bonusPoints }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bounceY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    // 등장 (중앙 페이드+스케일)
    scale.setValue(0.85);
    opacity.setValue(0);
    bounceY.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    // 아이콘 통통 튀는 애니메이션 (무한 반복)
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -10, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration: 380, easing: Easing.bounce, useNativeDriver: true }),
        Animated.delay(150),
      ])
    );
    bounceLoop.start();

    // 3초 후 부드럽게 퇴장 (긴 페이드 + 살짝 축소)
    const t = setTimeout(() => {
      bounceLoop.stop();
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.92, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => onAutoDismiss());
    }, DISPLAY_MS);

    return () => {
      bounceLoop.stop();
      clearTimeout(t);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrapper,
        { transform: [{ scale }], opacity },
      ]}
    >
      <View style={styles.toast}>
        {/* 원형 P 아이콘 (통통 튀는 애니메이션) */}
        <Animated.View style={[styles.iconCircleOuter, { transform: [{ translateY: bounceY }] }]}>
          <View style={styles.iconCircleInner}>
            <Text style={styles.iconP}>P</Text>
          </View>
        </Animated.View>

        {/* 텍스트 (아이콘 아래 세로 정렬) */}
        <Text style={styles.title}>{streak}일째 출석체크!</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.points}>{earnedPoints}P</Text>
          <Text style={styles.subtitleRest}>를 받았어요.</Text>
        </Text>
        {bonusPoints ? (
          <Text style={styles.bonus}>+보너스 {bonusPoints}P 🎉</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    width: Math.min(width - 80, 240),
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  iconCircleOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(140,208,175,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircleInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0B9A61',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B9A61',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  iconP: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitleRest: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  points: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B9A61',
  },
  bonus: {
    fontSize: 12,
    color: '#FFB800',
    fontWeight: '700',
    marginTop: 6,
  },
});
