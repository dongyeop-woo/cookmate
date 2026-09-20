import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchDau, fetchDauSeries, fetchRetention, fetchTimeToFirstRecipe,
  fetchReportsByReason, fetchReviewLength, fetchRefundReasons, fetchGifticonHeatmap,
  backfillImages,
  type DauDay, type RetentionResult, type TimeToFirstRecipe,
  type ReasonCount, type ReviewLengthStats, type GifticonHeatmap,
} from '../../services/api';

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dauToday, setDauToday] = useState<DauDay | null>(null);
  const [dauSeries, setDauSeries] = useState<DauDay[]>([]);
  const [retention, setRetention] = useState<RetentionResult | null>(null);
  const [ttfr, setTtfr] = useState<TimeToFirstRecipe | null>(null);
  const [reports, setReports] = useState<ReasonCount[]>([]);
  const [reviewLen, setReviewLen] = useState<ReviewLengthStats | null>(null);
  const [refunds, setRefunds] = useState<ReasonCount[]>([]);
  const [heatmap, setHeatmap] = useState<GifticonHeatmap | null>(null);

  const load = useCallback(async () => {
    try {
      const [dauT, dauS, ret, ttf, rep, rev, ref, heat] = await Promise.all([
        fetchDau().catch(() => null),
        fetchDauSeries(7).catch(() => []),
        fetchRetention().catch(() => null),
        fetchTimeToFirstRecipe().catch(() => null),
        fetchReportsByReason().catch(() => []),
        fetchReviewLength().catch(() => null),
        fetchRefundReasons().catch(() => []),
        fetchGifticonHeatmap().catch(() => null),
      ]);
      setDauToday(dauT);
      setDauSeries(dauS);
      setRetention(ret);
      setTtfr(ttf);
      setReports(rep);
      setReviewLen(rev);
      setRefunds(ref);
      setHeatmap(heat);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // 어드민 — 기존 Storage 이미지 일괄 리사이즈.
  // 페이지네이션으로 30개씩 끊어서 처리, nextPageToken 비어질 때까지 자동 반복.
  // 페이지마다 진행 상황 라벨 갱신.
  const [backfillRunning, setBackfillRunning] = useState<string | null>(null);
  const [backfillProgress, setBackfillProgress] = useState('');
  const runBackfill = (folder: 'recipeImages' | 'profileImages' | 'reviewImages') => {
    if (backfillRunning) return;
    Alert.alert(
      '이미지 일괄 리사이즈',
      `${folder} 폴더의 모든 이미지를 max 1200px 으로 리사이즈합니다.\n30개씩 끊어 처리하며 자동으로 끝까지 돌아갑니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '시작',
          onPress: async () => {
            setBackfillRunning(folder);
            setBackfillProgress('진행 중 0건...');
            // 누적 통계
            let totalProcessed = 0;
            let totalResized = 0;
            let totalSkipped = 0;
            let totalFailed = 0;
            let totalSavedMB = 0;
            let pageToken: string | undefined = undefined;
            try {
              while (true) {
                const r = await backfillImages(folder, pageToken, 30);
                totalProcessed += r.processed;
                totalResized += r.resized;
                totalSkipped += r.skipped;
                totalFailed += r.failed;
                totalSavedMB += parseFloat(r.savedMB) || 0;
                setBackfillProgress(`진행 중 ${totalProcessed}건 (절감 ${totalSavedMB.toFixed(1)}MB)...`);
                if (!r.nextPageToken) break;
                pageToken = r.nextPageToken;
              }
              Alert.alert(
                '완료',
                `처리 ${totalProcessed}건 / 리사이즈 ${totalResized} / 스킵 ${totalSkipped} / 실패 ${totalFailed}\n절감 ${totalSavedMB.toFixed(2)}MB`
              );
            } catch (e: any) {
              Alert.alert(
                '중단됨',
                `오류로 중단됐어요: ${e?.message || '알 수 없는 오류'}\n지금까지 ${totalProcessed}건 처리, ${totalSavedMB.toFixed(2)}MB 절감.\n같은 버튼 다시 눌러 처음부터 재실행 가능 (이미 처리된 건 자동 스킵).`
              );
            } finally {
              setBackfillRunning(null);
              setBackfillProgress('');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>통계 대시보드</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* DAU */}
          <Card title="오늘 접속 유저 (DAU)">
            <Text style={styles.bigNum}>{dauToday?.count ?? 0}명</Text>
            <Text style={styles.sub}>{dauToday?.date ?? ''}</Text>
            <View style={styles.sparkline}>
              {dauSeries.map((d, i) => {
                const max = Math.max(1, ...dauSeries.map(x => x.count));
                const h = (d.count / max) * 60;
                return (
                  <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View style={[styles.bar, { height: Math.max(h, 2) }]} />
                    <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* 리텐션 */}
          <Card title="재방문율 (리텐션)">
            {retention ? (
              <View style={styles.retentionRow}>
                <RetentionItem label="D1" data={retention.d1} />
                <RetentionItem label="D7" data={retention.d7} />
                <RetentionItem label="D30" data={retention.d30} />
              </View>
            ) : <Text style={styles.sub}>데이터 없음</Text>}
          </Card>

          {/* 첫 레시피 작성 시점 */}
          <Card title="가입 → 첫 레시피 작성">
            {ttfr ? (
              <>
                <View style={styles.statRow}>
                  <Stat label="작성한 유저" value={`${ttfr.withFirstRecipe}명`} />
                  <Stat label="미작성" value={`${ttfr.neverWrote}명`} />
                  <Stat label="중앙값" value={`${ttfr.medianDays.toFixed(0)}일`} />
                </View>
                {Object.entries(ttfr.buckets).map(([k, v]) => (
                  <Row key={k} label={k} value={`${v}명`} />
                ))}
              </>
            ) : <Text style={styles.sub}>데이터 없음</Text>}
          </Card>

          {/* 신고 사유 Top 5 */}
          <Card
            title="신고 사유 분포 Top 5"
            right={<Link onPress={() => router.push('/admin/reports')} label="전체" />}
          >
            {reports.slice(0, 5).map(r => (
              <Row key={r.reason} label={r.reason} value={`${r.count}건`} />
            ))}
            {reports.length === 0 && <Text style={styles.sub}>데이터 없음</Text>}
          </Card>

          {/* 리뷰 길이 분포 */}
          <Card title="후기 길이 분포">
            {reviewLen ? (
              <>
                <View style={styles.statRow}>
                  <Stat label="전체" value={`${reviewLen.total}건`} />
                  <Stat label="평균 길이" value={`${reviewLen.avgLength.toFixed(0)}자`} />
                </View>
                {Object.entries(reviewLen.buckets).map(([k, v]) => (
                  <Row key={k} label={k} value={`${v}건`} />
                ))}
              </>
            ) : <Text style={styles.sub}>데이터 없음</Text>}
          </Card>

          {/* 환불 사유 */}
          <Card
            title="환불 사유 Top 5"
            right={<Link onPress={() => router.push('/admin/refunds')} label="전체" />}
          >
            {refunds.slice(0, 5).map(r => (
              <Row key={r.reason} label={r.reason} value={`${r.count}건`} />
            ))}
            {refunds.length === 0 && <Text style={styles.sub}>데이터 없음</Text>}
          </Card>

          {/* 기프티콘 히트맵 */}
          <Card title="기프티콘 교환 시간 히트맵">
            {heatmap && heatmap.total > 0 ? (
              <>
                <Text style={styles.sub}>전체 {heatmap.total}건 · 요일 × 시간</Text>
                <View style={{ marginTop: 8 }}>
                  {/* 시간 헤더 */}
                  <View style={{ flexDirection: 'row', marginLeft: 20 }}>
                    {[0, 6, 12, 18, 23].map(h => (
                      <Text key={h} style={[styles.heatHeader, { flex: h === 23 ? 1 : (h === 0 ? 6 : 6) }]}>{h}</Text>
                    ))}
                  </View>
                  {DAYS_OF_WEEK.map((dow, dowIdx) => {
                    const max = Math.max(1, ...heatmap.heatmap.flat());
                    return (
                      <View key={dow} style={styles.heatRow}>
                        <Text style={styles.heatRowLabel}>{dow}</Text>
                        {heatmap.heatmap[dowIdx].map((v, h) => (
                          <View
                            key={h}
                            style={[
                              styles.heatCell,
                              { backgroundColor: `rgba(27, 174, 116, ${v / max})` },
                            ]}
                          />
                        ))}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : <Text style={styles.sub}>교환 내역 없음</Text>}
          </Card>

          {/* 상세 페이지 링크 */}
          <View style={styles.linkCard}>
            <LinkRow
              icon="gift-outline"
              label="기프티콘 수동 발급"
              desc="이벤트 보상 등 — 특정 유저에게 직접 발급"
              onPress={() => router.push('/admin/grant-gifticon')}
            />
            <LinkRow
              icon="leaf-outline"
              label="커스텀 재료 수집"
              desc="유저가 직접 입력한 재료 (공식 재료 승격 후보)"
              onPress={() => router.push('/admin/custom-ingredients')}
            />
            <LinkRow
              icon="search-outline"
              label="검색 실패 쿼리"
              desc="결과 0개로 끝난 검색어 (콘텐츠 추가 힌트)"
              onPress={() => router.push('/admin/failed-searches')}
            />
            <LinkRow
              icon="footsteps-outline"
              label="요리모드 이탈 지점"
              desc="레시피별 단계 이탈률"
              onPress={() => router.push('/admin/cooking-dropoff')}
            />
          </View>

          {/* 이미지 일괄 리사이즈 (백필) */}
          <View style={styles.linkCard}>
            <Text style={[styles.sub, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }]}>
              이미지 일괄 리사이즈 (max 1200px)
            </Text>
            <LinkRow
              icon="image-outline"
              label={backfillRunning === 'recipeImages' ? `레시피 이미지 ${backfillProgress}` : '레시피 이미지'}
              desc="recipeImages 폴더 전체"
              onPress={() => runBackfill('recipeImages')}
            />
            <LinkRow
              icon="chatbubbles-outline"
              label={backfillRunning === 'reviewImages' ? `리뷰 이미지 ${backfillProgress}` : '리뷰 이미지'}
              desc="reviewImages 폴더 전체"
              onPress={() => runBackfill('reviewImages')}
            />
            <LinkRow
              icon="person-outline"
              label={backfillRunning === 'profileImages' ? `프로필 이미지 ${backfillProgress}` : '프로필 이미지'}
              desc="profileImages 폴더 전체"
              onPress={() => runBackfill('profileImages')}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─────── 하위 컴포넌트 ───────

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}
function Link({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{label} ›</Text>
    </TouchableOpacity>
  );
}
function LinkRow({ icon, label, desc, onPress }: { icon: any; label: string; desc: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.linkIcon}><Ionicons name={icon} size={20} color="#1A1A1A" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkRowLabel}>{label}</Text>
        <Text style={styles.linkRowDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#BDBDBD" />
    </TouchableOpacity>
  );
}
function RetentionItem({ label, data }: { label: string; data: any }) {
  const pct = (data.rate * 100).toFixed(1);
  return (
    <View style={styles.retentionItem}>
      <Text style={styles.retentionLabel}>{label}</Text>
      <Text style={styles.retentionPct}>{pct}%</Text>
      <Text style={styles.retentionSub}>{data.retained}/{data.cohortSize}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECECEC',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },

  bigNum: { fontSize: 36, fontWeight: '800', color: '#1BAE74' },
  sub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },

  sparkline: {
    flexDirection: 'row', alignItems: 'flex-end',
    marginTop: 16, height: 80, gap: 6,
  },
  bar: { width: '80%', backgroundColor: '#1BAE74', borderRadius: 4 },
  barLabel: { fontSize: 10, color: '#8E8E93' },

  retentionRow: { flexDirection: 'row', gap: 8 },
  retentionItem: {
    flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F5F5F7', alignItems: 'center',
  },
  retentionLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '700' },
  retentionPct: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', marginTop: 4 },
  retentionSub: { fontSize: 11, color: '#8E8E93', marginTop: 2 },

  statRow: {
    flexDirection: 'row', gap: 12, marginBottom: 10,
    paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECECEC',
  },
  statLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '700' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginTop: 2 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: '#444', flex: 1, marginRight: 10 },
  rowValue: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },

  link: { fontSize: 12, color: '#1BAE74', fontWeight: '700' },

  heatRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginBottom: 1 },
  heatRowLabel: { fontSize: 10, color: '#8E8E93', width: 16, fontWeight: '700' },
  heatCell: { flex: 1, height: 10, borderRadius: 1 },
  heatHeader: { fontSize: 9, color: '#8E8E93', textAlign: 'left' },

  linkCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
  },
  linkIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
  },
  linkRowLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  linkRowDesc: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
});
