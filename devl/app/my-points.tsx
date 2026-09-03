import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { fetchUser, fetchPointHistory, filterAfterRejoin } from '../services/api';

type HistoryItem = {
  id: string;
  title: string;
  points: number;
  date: string;
  type: 'earn' | 'spend';
  balance: number;
};

type FilterTab = 'all' | 'earn' | 'spend';

export default function MyPointsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const params = useLocalSearchParams<{ uid?: string }>();
  const targetUid = params.uid || firebaseUser?.uid;
  const isAdminView = !!params.uid && params.uid !== firebaseUser?.uid;
  const [totalPoints, setTotalPoints] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [infoVisible, setInfoVisible] = useState(false);
  const [targetNickname, setTargetNickname] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const uid = targetUid;
          if (!uid) return;

          const [fresh, pointHistory] = await Promise.all([
            fetchUser(uid),
            fetchPointHistory(uid),
          ]);

          const points = fresh?.points ?? 0;
          if (fresh) {
            setTotalPoints(points);
            if (isAdminView) setTargetNickname(fresh.nickname || null);
          }

          // 재가입 유저는 rejoinedAt 이후 내역만 노출
          const visibleHistory = filterAfterRejoin(pointHistory, fresh?.rejoinedAt);
          // 최신순 정렬 후 누적 잔액 계산 (역순으로 계산)
          const sorted = [...visibleHistory].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          let running = points;
          const withBalance: HistoryItem[] = sorted.map((h) => {
            const item: HistoryItem = {
              id: h.id,
              title: h.title || h.description || '포인트 적립',
              points: h.amount,
              date: h.createdAt,
              type: h.type,
              balance: running,
            };
            // 다음 항목의 잔액은 이전 거래를 반영 (earn이면 빼고, spend면 더함)
            running = h.type === 'earn' ? running - h.amount : running + h.amount;
            return item;
          });
          setHistory(withBalance);
        } catch (e) {
          console.warn('포인트 로드 실패:', e);
        } finally {
          setLoading(false);
        }
      })();
    }, [targetUid, isAdminView])
  );

  const filtered = useMemo(() => {
    if (activeTab === 'all') return history;
    return history.filter(h => h.type === activeTab);
  }, [history, activeTab]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${dd} ${hh}:${mm}`;
  };

  const canExchange = totalPoints >= 2000;
  const progress = Math.min(totalPoints / 2000, 1);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {isAdminView ? `${targetNickname ?? '회원'}님 포인트` : '포인트'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* 잔액 */}
              <View style={styles.balanceSection}>
                <TouchableOpacity style={styles.balanceLabelRow} onPress={() => setInfoVisible(true)} activeOpacity={0.7}>
                  <Text style={styles.balanceLabel}>요잘알 포인트</Text>
                  <Ionicons name="information-circle-outline" size={14} color="#9E9E9E" />
                </TouchableOpacity>
                <Text style={styles.balanceAmount}>{totalPoints.toLocaleString()}<Text style={styles.balanceUnit}>P</Text></Text>
              </View>

              {/* 적립 진행률 카드 */}
              <View style={styles.progressCard}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressTitle}>기프티콘 교환까지</Text>
                  <Text style={styles.progressAmount}>
                    <Text style={canExchange ? { color: '#1A1A1A' } : undefined}>
                      {canExchange ? '교환 가능' : `${(2000 - totalPoints).toLocaleString()}P 남음`}
                    </Text>
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <View style={styles.progressLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#1BAE74' }]} />
                    <Text style={styles.legendText}>내 포인트</Text>
                  </View>
                  <Text style={styles.legendAmount}>{totalPoints.toLocaleString()}P</Text>
                </View>
                <View style={styles.progressLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#E0E0E0' }]} />
                    <Text style={styles.legendText}>목표 금액</Text>
                  </View>
                  <Text style={styles.legendAmount}>2,000P</Text>
                </View>
              </View>

              {/* 적립 기회 섹션 */}
              <Text style={styles.earnSectionTitle}>포인트 적립 기회</Text>
              {/* 눌러서 바로 이동 — 예전엔 안내만 하는 View 라 갈 데가 없었다 */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionCard}
                  activeOpacity={0.8}
                  onPress={() => router.push('/challenges' as any)}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="flame" size={18} color="#FF9800" />
                  </View>
                  <Text style={styles.actionTitle}>오늘의 도전</Text>
                  <Text style={styles.actionSub}>7일마다 +40P</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  activeOpacity={0.8}
                  onPress={() => router.push('/(tabs)/recipe' as any)}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="chatbubble-ellipses" size={18} color="#FF4D67" />
                  </View>
                  <Text style={styles.actionTitle}>후기 작성</Text>
                  <Text style={styles.actionSub}>최대 +20P</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  activeOpacity={0.8}
                  onPress={() => router.push('/recipe/edit' as any)}
                >
                  <View style={styles.actionIconWrap}>
                    <Ionicons name="restaurant" size={18} color="#2196F3" />
                  </View>
                  <Text style={styles.actionTitle}>레시피 작성</Text>
                  <Text style={styles.actionSub}>승인 시 +100P</Text>
                </TouchableOpacity>
              </View>

              {/* 필터 탭 */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                  onPress={() => setActiveTab('all')}
                >
                  <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>전체</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'earn' && styles.tabActive]}
                  onPress={() => setActiveTab('earn')}
                >
                  <Text style={[styles.tabText, activeTab === 'earn' && styles.tabTextActive]}>적립</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'spend' && styles.tabActive]}
                  onPress={() => setActiveTab('spend')}
                >
                  <Text style={[styles.tabText, activeTab === 'spend' && styles.tabTextActive]}>사용</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
                <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.historyPoints, item.type === 'spend' && styles.historyPointsSpend]}>
                  {item.type === 'spend' ? '-' : '+'}{item.points.toLocaleString()}P
                </Text>
                <Text style={styles.historyBalance}>잔액 {item.balance.toLocaleString()}P</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>
                {activeTab === 'earn' ? '적립 내역이 없어요' : activeTab === 'spend' ? '사용 내역이 없어요' : '아직 내역이 없어요'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={infoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.infoOverlay}>
          <View style={styles.infoModal}>
            <Text style={styles.infoTitle}>요잘알 포인트</Text>
            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.45 }} showsVerticalScrollIndicator={false} nestedScrollEnabled bounces={false}>
              <Text style={styles.infoBody}>
                <Text style={styles.infoBullet}>• </Text>
                <Text style={styles.infoStrong}>적립 방법</Text>: 일일 도전과제 연속 달성, 후기 작성, 레시피 작성·승인, 이벤트 참여를 통해 적립할 수 있어요.
              </Text>
              <Text style={styles.infoBody}>
                <Text style={styles.infoBullet}>• </Text>
                <Text style={styles.infoStrong}>사용처</Text>: 앱 내 기프티콘 교환에만 사용 가능하며, 현금 환불이나 타 계정으로 이전은 불가합니다.
              </Text>
              <Text style={styles.infoBody}>
                <Text style={styles.infoBullet}>• </Text>
                <Text style={styles.infoStrong}>적립 포인트 규정</Text>
                {'\n'}  - 일일 도전과제: 하루 하나라도 완료 시 연속 유지, 7일마다 +40P
                {'\n'}  - 후기 작성: 별점·텍스트 +10P, 사진 첨부 시 +20P
                {'\n'}  - 레시피 작성: 관리자 승인 시 +100P
              </Text>
              <Text style={styles.infoBody}>
                <Text style={styles.infoBullet}>• </Text>
                <Text style={styles.infoStrong}>어뷰징 방지</Text>: 다중 계정, 자동화, 허위 후기 등 부정한 방법으로 적립된 포인트는 사전 통지 없이 회수되며, 계정이 제한될 수 있습니다.
              </Text>
              <Text style={styles.infoBody}>
                <Text style={styles.infoBullet}>• </Text>
                <Text style={styles.infoStrong}>유효 기간</Text>: 회원 탈퇴 시 잔여 포인트는 즉시 소멸되며 복구되지 않습니다.
              </Text>
              <Text style={styles.infoBody}>
                <Text style={styles.infoBullet}>• </Text>
                <Text style={styles.infoStrong}>기프티콘 환불</Text>: 교환 후 3일 이내 신청 시 검토 후 처리되며(영업일 기준 1일 이내, 주말·공휴일 제외), 사용한 기프티콘은 환불이 불가합니다.
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.infoCloseBtn} onPress={() => setInfoVisible(false)}>
              <Text style={styles.infoCloseText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  balanceSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  balanceLabel: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },
  balanceAmount: { fontSize: 34, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  balanceUnit: { fontSize: 22, fontWeight: '700' },

  progressCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  progressAmount: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E8EAED',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1BAE74',
  },
  progressLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#666' },
  legendAmount: { fontSize: 12, color: '#1A1A1A', fontWeight: '600' },

  earnSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 8,
  },
  actionCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionTitle: { fontSize: 12, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  actionSub: { fontSize: 10, color: '#9E9E9E' },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1A1A1A' },
  tabText: { fontSize: 14, color: '#9E9E9E', fontWeight: '600' },
  tabTextActive: { color: '#1A1A1A', fontWeight: '800' },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  historyDate: { fontSize: 12, color: '#9E9E9E', marginBottom: 4 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  historyPoints: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  historyPointsSpend: { color: '#FF4D67' },
  historyBalance: { fontSize: 11, color: '#9E9E9E', marginTop: 4 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 10,
  },
  emptyText: { fontSize: 14, color: '#9E9E9E' },

  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  infoModal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoBody: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoBullet: { color: '#1A1A1A', fontWeight: '700' },
  infoStrong: { fontWeight: '700', color: '#1A1A1A' },
  infoCloseBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1BAE74',
    alignItems: 'center',
  },
  infoCloseText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
