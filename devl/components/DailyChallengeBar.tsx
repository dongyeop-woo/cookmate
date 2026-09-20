import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ChallengeToday } from '../services/api';

/**
 * 홈 상단 일일 도전과제 띠 — 검색창 바로 아래.
 * 홈의 다른 카드와 같은 문법(그라데이션 테두리 + 안쪽 흰 카드)을 쓰되,
 * 테두리 색은 바로 위 검색창과 같은 그린으로 맞춰 이어지게 한다.
 * 비로그인이거나 로드 전이면 렌더하지 않는다.
 */
const BORDER_GRADIENT: readonly [string, string] = ['#A8E8C4', '#5FB896'];
const ACCENT_GRADIENT: readonly [string, string] = ['#1BAE74', '#0B9A61'];
const INNER_GRADIENT: readonly [string, string] = ['#FFFFFF', '#F2FBF6'];

type Props = {
  data: ChallengeToday | null;
  onPress: () => void;
};

function DailyChallengeBarBase({ data, onPress }: Props) {
  if (!data) return null;

  const { tasks, dayCompleted, currentStreak, nextBonusIn } = data;
  const nextTask = tasks.find(t => !t.completed);

  const label = dayCompleted
    ? nextBonusIn === 0
      ? '연속 보너스 달성'
      : `${nextBonusIn}일 더 채우면 +40P`
    : (nextTask?.title ?? '오늘의 도전');

  return (
    <LinearGradient
      colors={BORDER_GRADIENT}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.border}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.cardWrap}>
        <LinearGradient
          colors={INNER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <LinearGradient
            colors={ACCENT_GRADIENT}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.badge}
          >
            <Text style={styles.badgeDays}>{currentStreak}일</Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {dayCompleted ? '오늘 완료했어요' : '오늘의 도전'}
            </Text>
            <Text style={styles.label} numberOfLines={1}>{label}</Text>
          </View>

          <View style={styles.dots}>
            {tasks.map(t => (
              <View key={t.id} style={[styles.dot, t.completed && styles.dotDone]} />
            ))}
          </View>

          <LinearGradient
            colors={ACCENT_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submit}
          >
            <Ionicons
              name={dayCompleted ? 'checkmark' : 'arrow-forward'}
              size={16}
              color="#FFFFFF"
            />
          </LinearGradient>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

export default memo(DailyChallengeBarBase);

const styles = StyleSheet.create({
  // AI 추천 카드와 동일한 외곽 규격 (marginHorizontal 16 / radius 24 / padding 1.5)
  border: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 24,
    padding: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardWrap: { borderRadius: 22.5, overflow: 'hidden' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 22.5,
    gap: 9,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    height: 28,
    borderRadius: 14,
  },
  badgeDays: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Platform.OS === 'ios' ? 2 : 0,
  },
  title: { fontSize: 10.5, color: '#7A8B82', fontWeight: '700' },
  label: { fontSize: 13.5, color: '#1A1A1A', fontWeight: '700', marginTop: 1 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DDEDE4',
  },
  dotDone: { backgroundColor: '#1BAE74' },
  submit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
