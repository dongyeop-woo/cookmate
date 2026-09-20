import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchCommunityRecipes, updateCommunityStatus } from '../../services/api';
import type { CommunityRecipe } from '../../constants/community';

type Filter = 'pending' | 'all';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending:  { text: '검토 중', color: '#FF9500' },
  approved: { text: '승인됨', color: '#1A1A1A' },
  rejected: { text: '거절됨', color: '#FF3B30' },
};

export default function AdminCommunityScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<CommunityRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [rejectTarget, setRejectTarget] = useState<CommunityRecipe | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCommunityRecipes(true);
      setRecipes(data);
    } catch {
      Alert.alert('오류', '커뮤니티 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleApprove = (recipe: CommunityRecipe) => {
    Alert.alert('승인', `"${recipe.title}" 레시피를 승인하시겠어요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '승인',
        onPress: async () => {
          try {
            await updateCommunityStatus(recipe.id, 'approved');
            setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, status: 'approved' } : r));
          } catch (e: any) {
            Alert.alert('승인 실패', e?.message || '승인에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const handleReject = (recipe: CommunityRecipe) => {
    setRejectReason('');
    setRejectTarget(recipe);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      await updateCommunityStatus(rejectTarget.id, 'rejected', rejectReason.trim() || undefined);
      setRecipes(prev => prev.map(r =>
        r.id === rejectTarget.id ? { ...r, status: 'rejected', rejectionReason: rejectReason.trim() || undefined } : r
      ));
    } catch {
      Alert.alert('오류', '거절 처리에 실패했습니다.');
    } finally {
      setRejectTarget(null);
      setRejectReason('');
    }
  };

  const filtered = (() => {
    const base = filter === 'pending'
      ? recipes.filter(r => !r.status || r.status === 'pending')
      : recipes;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(r =>
      (r.title || '').toLowerCase().includes(q) ||
      (r.author || '').toLowerCase().includes(q)
    );
  })();

  // 작성자별 오늘 승인 건수 (KST 기준)
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const approvedTodayByUid: Record<string, number> = {};
  recipes.forEach(r => {
    if (r.status === 'approved' && r.authorUid && (r as any).approvedAt) {
      const approvedDate = new Date(new Date((r as any).approvedAt).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      if (approvedDate === todayKST) {
        approvedTodayByUid[r.authorUid] = (approvedTodayByUid[r.authorUid] || 0) + 1;
      }
    }
  });
  const DAILY_LIMIT = 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 반려 사유 입력 모달 */}
      <Modal
        visible={!!rejectTarget}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setRejectTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>반려 사유 입력</Text>
            <Text style={styles.modalSub}>"{rejectTarget?.title}"</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="사유를 입력해주세요 (선택)"
              placeholderTextColor="#BDBDBD"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectTarget(null)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={confirmReject}>
                <Text style={styles.modalRejectText}>거절</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.title}>커뮤니티 관리</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={styles.count}>{filtered.length}개</Text>
          <TouchableOpacity
            onPress={() => {
              setSearchOpen(prev => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
            hitSlop={10}
          >
            <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="작성자 또는 레시피 이름으로 검색"
            placeholderTextColor="#BDBDBD"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color="#C4C4C4" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>검토 대기</Text>
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
          <Text style={styles.emptyText}>
            {filter === 'pending' ? '검토 대기 중인 레시피가 없습니다' : '레시피가 없습니다'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const statusInfo = STATUS_LABEL[item.status ?? 'pending'];
            const goDetail = () => router.push(`/recipe/${item.id}?type=community`);
            return (
              <View style={styles.card}>
                <TouchableOpacity style={styles.cardTop} activeOpacity={0.7} onPress={goDetail}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumb} cachePolicy="disk" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Text style={{ fontSize: 20 }}>🍳</Text>
                    </View>
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.author}>{item.author}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <View style={styles.statusBadge}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
                      </View>
                      {item.authorUid && (() => {
                        const approved = approvedTodayByUid[item.authorUid] || 0;
                        const reachedLimit = approved >= DAILY_LIMIT;
                        return (
                          <View style={[styles.dailyBadge, reachedLimit && styles.dailyBadgeMax]}>
                            <Text style={[styles.dailyBadgeText, reachedLimit && styles.dailyBadgeTextMax]}>
                              오늘 승인 {approved}/{DAILY_LIMIT}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                    {item.status === 'rejected' && item.rejectionReason ? (
                      <Text style={styles.rejectionReason} numberOfLines={2}>사유: {item.rejectionReason}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.viewBtn} onPress={goDetail}>
                    <Ionicons name="eye-outline" size={14} color="#1A1A1A" />
                    <Text style={styles.viewBtnText}>보기</Text>
                  </TouchableOpacity>
                  {(!item.status || item.status === 'pending') && (
                    <>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                        <Text style={styles.approveBtnText}>승인</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                        <Text style={styles.rejectBtnText}>거절</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', padding: 0 },
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
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#F5F5F5' },
  thumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  author: { fontSize: 12, color: '#999', marginTop: 2 },
  rejectionReason: { fontSize: 12, color: '#FF3B30', marginTop: 4 },
  statusBadge: { alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#999', marginBottom: 16 },
  reasonInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#1A1A1A',
    minHeight: 80, textAlignVertical: 'top',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#F0F0F0', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  modalRejectBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: '#FF3B30', alignItems: 'center',
  },
  modalRejectText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: {
    flex: 1, backgroundColor: '#1A1A1A',
    paddingVertical: 8, borderRadius: 8, alignItems: 'center',
  },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  rejectBtn: {
    flex: 1, backgroundColor: '#F0F0F0',
    paddingVertical: 8, borderRadius: 8, alignItems: 'center',
  },
  rejectBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },
  viewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E0E0',
    paddingVertical: 8, borderRadius: 8,
  },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  dailyBadge: {},
  dailyBadgeText: { fontSize: 11, fontWeight: '700', color: '#1A1A1A', lineHeight: 14 },
  dailyBadgeMax: {},
  dailyBadgeTextMax: { color: '#D32F2F' },
});
