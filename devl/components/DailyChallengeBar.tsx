import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChallengeToday } from '../services/api';

/**
 * 홈 상단 일일 도전과제 띠 — 한 줄짜리 요약.
 * 본체는 /challenges 화면에 있고 여기선 "오늘 뭐 남았는지"만 보여준다.
 * 비로그인이거나 아직 로드 전이면 렌더하지 않는다 (홈 상단이 이미 빡빡함).
 */
type Props = {
  data: ChallengeToday | null;
  onPress: () => void;
};

function DailyChallengeBarBase({ data, onPress }: Props) {
  if (!data) return null;

  const { tasks, dayCompleted, currentStreak, nextBonusIn } = data;
  const nextTask = tasks.find(t => !t.completed);

  // 오늘 할 일이 끝났으면 다음 보너스까지, 아니면 다음 과제를 안내
  const label = dayCompleted
    ? nextBonusIn === 0
      ? '오늘 완료 · 연속 보너스 달성!'
      : `오늘 완료 · ${nextBonusIn}일 뒤 +40P`
    : nextTask?.title ?? '오늘의 도전';

  return (
    <TouchableOpacity style={styles.wrap} activeOpacity={0.85} onPress={onPress}>
      <View style={[styles.streakBadge, currentStreak === 0 && styles.streakBadgeIdle]}>
        <Text style={styles.streakEmoji}>🔥</Text>
        <Text style={styles.streakText}>{currentStreak}일</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {dayCompleted ? '오늘의 도전' : '오늘의 도전 · 하나만 하면 연속 유지'}
        </Text>
        <Text
          style={[styles.label, dayCompleted && styles.labelDone]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>

      <View style={styles.dots}>
        {tasks.map(t => (
          <View
            key={t.id}
            style={[styles.dot, t.completed && styles.dotDone]}
          />
        ))}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#B5C2CC" />
    </TouchableOpacity>
  );
}

export default memo(DailyChallengeBarBase);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFF1E8',
  },
  streakBadgeIdle: { backgroundColor: '#F4F5F6' },
  streakEmoji: { fontSize: 12 },
  streakText: { fontSize: 12, fontWeight: '800', color: '#E8590C' },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 11, color: '#9AA0A6', fontWeight: '600' },
  label: { fontSize: 13.5, color: '#1A1A1A', fontWeight: '700', marginTop: 1 },
  labelDone: { color: '#1BAE74' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#E3E6E8',
  },
  dotDone: { backgroundColor: '#1BAE74' },
});
