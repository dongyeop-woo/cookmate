import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { fetchTodayChallenges, type ChallengeToday, type ChallengeTask } from '../services/api';

const BONUS_EVERY = 7;
const BONUS_POINTS = 40;

/** 과제별 아이콘·이동 경로. id 는 백엔드 ChallengeService.TASKS 와 맞춰야 한다. */
const TASK_META: Record<
  ChallengeTask['id'],
  { icon: keyof typeof Ionicons.glyphMap; color: string; route: string; cta: string }
> = {
  listen: { icon: 'volume-high', color: '#7B61FF', route: '/(tabs)/recipe', cta: '레시피 고르기' },
  like:   { icon: 'heart',       color: '#FF4D67', route: '/(tabs)/recipe', cta: '레시피 둘러보기' },
  review: { icon: 'create',      color: '#1BAE74', route: '/my-activity',   cta: '후기 쓰러 가기' },
};

export default function ChallengesScreen() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [data, setData] = useState<ChallengeToday | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const uid = firebaseUser?.uid;
    if (!uid) { setLoading(false); return; }
    try {
      setData(await fetchTodayChallenges(uid));
    } catch (e: any) {
      console.warn('도전과제 로드 실패:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.uid]);

  // 과제를 수행하고 돌아오면 즉시 반영
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const streak = data?.currentStreak ?? 0;
  const nextBonusIn = data?.nextBonusIn ?? BONUS_EVERY;
  // 이번 주기에서 채운 칸 수 (7칸 중)
  const filled = nextBonusIn === 0 ? BONUS_EVERY : BONUS_EVERY - nextBonusIn;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>오늘의 도전</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#1BAE74" /></View>
      ) : !firebaseUser ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>로그인하면 도전과제에 참여할 수 있어요.</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login' as any)}>
            <Text style={styles.loginBtnText}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {/* 연속 현황 */}
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakDays}>{streak}일 연속</Text>
            <Text style={styles.streakSub}>
              {nextBonusIn === 0
                ? `오늘 완료하면 +${BONUS_POINTS}P!`
                : `${nextBonusIn}일 더 채우면 +${BONUS_POINTS}P`}
            </Text>
            <View style={styles.dotsRow}>
              {Array.from({ length: BONUS_EVERY }).map((_, i) => (
                <View key={i} style={[styles.weekDot, i < filled && styles.weekDotOn]} />
              ))}
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            오늘의 과제{'  '}
            <Text style={styles.sectionCount}>
              {data?.completedCount ?? 0}/{data?.totalCount ?? 0}
            </Text>
          </Text>
          <Text style={styles.sectionSub}>하나만 완료해도 연속이 이어져요.</Text>

          {(data?.tasks ?? []).map(task => {
            const meta = TASK_META[task.id];
            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskCard, task.completed && styles.taskCardDone]}
                activeOpacity={task.completed ? 1 : 0.85}
                disabled={task.completed}
                onPress={() => router.push(meta.route as any)}
              >
                <View style={[styles.taskIcon, { backgroundColor: `${meta.color}1A` }]}>
                  <Ionicons
                    name={task.completed ? 'checkmark' : meta.icon}
                    size={19}
                    color={task.completed ? '#1BAE74' : meta.color}
                  />
                </View>
                <View style={styles.taskBody}>
                  <Text style={[styles.taskTitle, task.completed && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                  <Text style={styles.taskSub}>{task.completed ? '완료했어요' : task.sub}</Text>
                </View>
                {task.completed ? (
                  <Text style={styles.taskDoneLabel}>완료</Text>
                ) : (
                  <Text style={styles.taskCta}>{meta.cta} ›</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>안내</Text>
            <Text style={styles.infoBody}>
              • 과제 완료 자체에는 포인트가 없어요. 대신 하루 하나만 완료해도 연속이 이어지고,
              {BONUS_EVERY}일마다 {BONUS_POINTS}P를 드려요.{'\n'}
              • 하루라도 건너뛰면 연속은 1일부터 다시 시작돼요.{'\n'}
              • 포인트는 후기 작성(+10~20P), 레시피 등록(승인 시 +100P), 친구 초대로 모을 수 있어요.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center' },
  loginBtn: {
    paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 10, backgroundColor: '#1BAE74',
  },
  loginBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  body: { padding: 20, paddingBottom: 40 },

  streakCard: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 18,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#FFE6D5',
    marginBottom: 26,
  },
  streakEmoji: { fontSize: 32 },
  streakDays: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginTop: 6 },
  streakSub: { fontSize: 13, color: '#E8590C', fontWeight: '600', marginTop: 4 },
  dotsRow: { flexDirection: 'row', gap: 7, marginTop: 16 },
  weekDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F0DFD3' },
  weekDotOn: { backgroundColor: '#FF922B' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  sectionCount: { fontSize: 14, color: '#1BAE74', fontWeight: '700' },
  sectionSub: { fontSize: 12.5, color: '#9AA0A6', marginTop: 3, marginBottom: 14 },

  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    marginBottom: 10,
  },
  taskCardDone: { backgroundColor: '#F7FCF9', borderColor: '#DCF0E6' },
  taskIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  taskBody: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 14.5, fontWeight: '700', color: '#1A1A1A' },
  taskTitleDone: { color: '#7C8B84' },
  taskSub: { fontSize: 12, color: '#9AA0A6', marginTop: 2 },
  taskCta: { fontSize: 12.5, fontWeight: '700', color: '#1BAE74' },
  taskDoneLabel: { fontSize: 12.5, fontWeight: '700', color: '#1BAE74' },

  infoBox: {
    marginTop: 18, padding: 14,
    borderRadius: 12, backgroundColor: '#FAFAFA',
  },
  infoTitle: { fontSize: 13, fontWeight: '800', color: '#555', marginBottom: 6 },
  infoBody: { fontSize: 12, color: '#888', lineHeight: 19 },
});
