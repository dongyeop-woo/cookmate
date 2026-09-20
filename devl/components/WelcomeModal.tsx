import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onAutoDismiss: () => void;
  earnedPoints: number;
}

const DISPLAY_MS = 3000;

/**
 * 가입 환영 토스트. AttendanceModal과 동일 디자인, 중앙 아이콘만 🎉 이모지로.
 */
export default function WelcomeToast({ visible, onAutoDismiss, earnedPoints }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bounceY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.85);
    opacity.setValue(0);
    bounceY.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -10, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration: 380, easing: Easing.bounce, useNativeDriver: true }),
        Animated.delay(150),
      ])
    );
    bounceLoop.start();

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
      style={[styles.wrapper, { transform: [{ scale }], opacity }]}
    >
      <View style={styles.toast}>
        {/* 원형 선물 아이콘 (통통 튀는 애니메이션) */}
        <Animated.View style={[styles.iconCircleOuter, { transform: [{ translateY: bounceY }] }]}>
          <View style={styles.iconCircleInner}>
            <Ionicons name="gift" size={28} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Text style={styles.title}>환영합니다!</Text>
        <Text style={styles.breakdown}>
          가입 보상 <Text style={styles.breakdownPoints}>300P</Text>
          <Text style={styles.breakdownDim}> + </Text>
          첫 출석 <Text style={styles.breakdownPoints}>200P</Text>
        </Text>
        <Text style={styles.subtitle}>
          <Text style={styles.totalLabel}>총 </Text>
          <Text style={styles.points}>{earnedPoints}P</Text>
          <Text style={styles.subtitleRest}> 적립</Text>
        </Text>
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
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  breakdown: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    marginBottom: 6,
  },
  breakdownPoints: {
    color: '#0B9A61',
    fontWeight: '800',
  },
  breakdownDim: {
    color: '#BBB',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#0B9A61',
  },
});
