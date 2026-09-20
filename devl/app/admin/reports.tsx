import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchReports, resolveReport } from '../../services/api';
import type { Report } from '../../services/api';

const TARGET_TYPE_LABEL: Record<Report['targetType'], string> = {
  recipe: '레시피',
  community: '커뮤니티',
  user: '유저',
  comment: '댓글',
};

const STATUS_LABEL: Record<Report['status'], { text: string; color: string }> = {
  pending: { text: '처리 대기', color: '#FF9500' },
  resolved: { text: '처리 완료', color: '#1A1A1A' },
  dismissed: { text: '기각', color: '#999' },
};

export default function AdminReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReports();
      setReports(data);
    } catch {
      Alert.alert('오류', '신고 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleAction = (report: Report, action: 'resolved' | 'dismissed') => {
    const label = action === 'resolved' ? '처리 완료' : '기각';
    Alert.alert('신고 처리', `이 신고를 "${label}"로 처리하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          try {
            await resolveReport(report.id, action);
            setReports(prev =>
              prev.map(r => r.id === report.id ? { ...r, status: action } : r)
            );
          } catch {
            Alert.alert('오류', '처리에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const filtered = filter === 'pending'
    ? reports.filter(r => r.status === 'pending')
    : reports;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>신고 처리</Text>
        </View>
        <Text style={styles.count}>{filtered.length}건</Text>
      </View>

      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>대기 중</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>전체</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1A1A1A" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle-outline" size={48} color="#E0E0E0" />
          <Text style={styles.emptyText}>처리할 신고가 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const status = STATUS_LABEL[item.status];
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{TARGET_TYPE_LABEL[item.targetType]}</Text>
                  </View>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                  <Text style={styles.dateText}>
                    {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                  </Text>
                </View>
                {item.targetTitle && (
                  <Text style={styles.targetTitle} numberOfLines={1}>대상: {item.targetTitle}</Text>
                )}
                <Text style={styles.reason}>사유: {item.reason}</Text>
                {item.reporterNickname && (
                  <Text style={styles.reporter}>신고자: {item.reporterNickname}</Text>
                )}
                {(() => {
                  const route =
                    item.targetType === 'recipe' ? `/recipe/${item.targetId}`
                    : item.targetType === 'community' ? `/community/${item.targetId}`
                    : item.targetType === 'user' ? `/profile/${item.targetId}`
                    : null;
                  const label =
                    item.targetType === 'user' ? '프로필 보기'
                    : item.targetType === 'comment' ? null
                    : '레시피 보기';
                  if (!route || !label) return null;
                  return (
                    <TouchableOpacity
                      style={styles.viewBtn}
                      onPress={() => router.push(route as any)}
                    >
                      <Ionicons name="open-outline" size={14} color="#1A1A1A" />
                      <Text style={styles.viewBtnText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })()}
                {item.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => handleAction(item, 'resolved')}
                    >
                      <Text style={styles.resolveBtnText}>처리 완료</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dismissBtn}
                      onPress={() => handleAction(item, 'dismissed')}
                    >
                      <Text style={styles.dismissBtnText}>기각</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  titleWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  count: { fontSize: 13, color: '#999' },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
  },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F5F5F5',
  },
  filterBtnActive: { backgroundColor: '#1A1A1A' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#999' },
  filterTextActive: { color: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#BDBDBD' },
  card: {
    marginHorizontal: 16, marginTop: 12,
    padding: 14, borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typeBadge: {
    backgroundColor: '#E8F8F2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  statusText: { fontSize: 12, fontWeight: '600' },
  dateText: { fontSize: 12, color: '#BDBDBD', marginLeft: 'auto' },
  targetTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  reason: { fontSize: 13, color: '#555', marginBottom: 4 },
  reporter: { fontSize: 12, color: '#999', marginBottom: 10 },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  resolveBtn: {
    flex: 1, backgroundColor: '#1A1A1A',
    paddingVertical: 8, borderRadius: 8, alignItems: 'center',
  },
  resolveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  dismissBtn: {
    flex: 1, backgroundColor: '#F0F0F0',
    paddingVertical: 8, borderRadius: 8, alignItems: 'center',
  },
  dismissBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },
});
