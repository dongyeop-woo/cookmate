import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  /** "좋아요" — 여기서만 시스템 권한창을 띄운다. */
  onAccept: () => void;
  /** "나중에" — 시스템 권한창을 띄우지 않고 닫는다. */
  onDecline: () => void;
}

/**
 * 푸시 알림 사전 동의 시트.
 *
 * iOS 는 시스템 권한창에서 한 번 거부당하면 앱에서 다시 물을 수 없고,
 * 사용자가 설정 앱에 직접 들어가야 한다. 즉 기회가 딱 한 번뿐이다.
 * 그래서 시스템 창을 바로 띄우지 않고, 먼저 이 화면으로 "왜 필요한지"를
 * 설명한 뒤 "좋아요" 를 누른 사람에게만 시스템 창을 넘긴다.
 * "나중에" 를 누르면 시스템 창을 띄우지 않으므로 기회가 그대로 남는다.
 */
export default function PushOptInSheet({ visible, onAccept, onDecline }: Props) {
  const slideY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const bellRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    slideY.setValue(60);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 70 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    // 종 흔들기 — 시선을 한 번 잡아주는 정도로만.
    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(bellRotate, { toValue: 1, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: -1, duration: 240, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(bellRotate, { toValue: 0, duration: 120, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(1800),
      ]),
    );
    shake.start();
    return () => shake.stop();
  }, [visible, slideY, opacity, bellRotate]);

  const rotate = bellRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.sheet, { opacity, transform: [{ translateY: slideY }] }]}
        >
          <Animated.View style={[styles.iconCircle, { transform: [{ rotate }] }]}>
            <Ionicons name="notifications" size={34} color="#1BAE74" />
          </Animated.View>

          <Text style={styles.title}>새 레시피가 올라오면{'\n'}알려드릴까요?</Text>
          <Text style={styles.body}>
            매일 아침 그날의 레시피와{'\n'}출석 포인트를 챙겨드려요
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onAccept}
          >
            <Text style={styles.primaryText}>좋아요</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={onDecline}
          >
            <Text style={styles.secondaryText}>나중에</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  sheet: {
    width: Math.min(width - 64, 340),
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E8F7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 27,
  },
  body: {
    marginTop: 10,
    fontSize: 14,
    color: '#7B8380',
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryBtn: {
    marginTop: 22,
    alignSelf: 'stretch',
    backgroundColor: '#1BAE74',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    marginTop: 4,
    alignSelf: 'stretch',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#9AA2A0', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
