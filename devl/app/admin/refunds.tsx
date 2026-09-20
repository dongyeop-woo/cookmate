import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchRefundRequests, approveRefund, rejectRefund, checkRefundCouponStatus, type RefundRequest } from '../../services/api';

export default function AdminRefundsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selected, setSelected] = useState<RefundRequest | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRequests = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(r => (r.nickname || '').toLowerCase().includes(q));
  }, [requests, searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRefundRequests(filter);
      setRequests(data);
    } catch (e) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApprove = async (req: RefundRequest) => {
    // 1. 먼저 기프티쇼에서 쿠폰 상태 조회
    let statusInfo = '';
    let cancelable = true;
    try {
      const status = await checkRefundCouponStatus(req.id);
      if (status.error) {
        statusInfo = `\n\n⚠️ 쿠폰 상태 조회 실패: ${status.error}`;
      } else {
        cancelable = !!status.cancelable;
        statusInfo = `\n\n📋 쿠폰 상태: ${status.pinStatusNm || status.pinStatusCd}${cancelable ? ' ✅' : ' ❌ 취소 불가'}`;
        if (status.validPrdEndDt) statusInfo += `\n유효기간: ${status.validPrdEndDt}`;
      }
    } catch (e: any) {
      statusInfo = `\n\n⚠️ 상태 조회 실패: ${e.message}`;
    }

    const title = cancelable ? '환불 승인' : '⚠️ 취소 불가 쿠폰';
    const message = cancelable
      ? `${req.nickname}님의 ${req.gifticonName} 환불을 승인하시겠어요?\n\n• 기프티쇼 쿠폰이 자동 취소됩니다\n• ${req.pointCost.toLocaleString()}P가 유저에게 환급됩니다${statusInfo}`
      : `이 쿠폰은 기프티쇼에서 취소 불가 상태입니다!${statusInfo}\n\n그래도 승인하면:\n• 유저에게 ${req.pointCost.toLocaleString()}P 환급\n• 비즈머니는 돌려받지 못함 (손실 발생)\n\n정말 승인할까요?`;

    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      {
        text: cancelable ? '승인' : '강제 승인',
        style: cancelable ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await approveRefund(req.id);
            Alert.alert('승인 완료', '환불이 처리되었어요.');
            load();
          } catch (e: any) {
            Alert.alert('승인 실패', e.message || '잠시 후 다시 시도해주세요.');
          }
        },
      },
    ]);
  };

  const handleRejectOpen = (req: RefundRequest) => {
    setSelected(req);
    setRejectNote('');
    setRejectModalVisible(true);
  };

  const handleRejectSubmit = async () => {
    if (!selected) return;
    try {
      await rejectRefund(selected.id, rejectNote.trim() || undefined);
      setRejectModalVisible(false);
      setSelected(null);
      Alert.alert('반려 완료', '환불 요청이 반려되었어요.');
      load();
    } catch (e: any) {
      Alert.alert('반려 실패', e.message || '잠시 후 다시 시도해주세요.');
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>환불 요청 관리</Text>
        <TouchableOpacity
          onPress={() => {
            setSearchOpen(prev => {
              if (prev) setSearchQuery('');
              return !prev;
            });
          }}
          style={{ width: 32, alignItems: 'center' }}
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="작성자 닉네임으로 검색"
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

      <View style={styles.tabRow}>
        {(['pending', 'approved', 'rejected'] as const).map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, filter === s && styles.tabActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.tabText, filter === s && styles.tabTextActive]}>
              {s === 'pending' ? '대기중' : s === 'approved' ? '승인됨' : '반려됨'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={filteredRequests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>요청이 없습니다.</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.nickname}>{item.nickname || item.uid}</Text>
                <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.gifticonName} numberOfLines={1}>{item.brand} · {item.gifticonName}</Text>
              <Text style={styles.pointCost}>{item.pointCost.toLocaleString()}P 환급 예정</Text>
              <View style={styles.reasonBox}>
                <Text style={styles.reasonLabel}>환불 사유</Text>
                <Text style={styles.reason}>{item.reason}</Text>
              </View>
              {item.adminNote ? (
                <View style={[styles.reasonBox, { backgroundColor: '#FFF8E1' }]}>
                  <Text style={styles.reasonLabel}>관리자 메모</Text>
                  <Text style={styles.reason}>{item.adminNote}</Text>
                </View>
              ) : null}
              {filter === 'pending' && (
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleRejectOpen(item)}>
                    <Text style={styles.rejectText}>반려</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.approveBtn]} onPress={() => handleApprove(item)}>
                    <Text style={styles.approveText}>승인</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>반려 사유</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="반려 사유를 입력해주세요 (선택)"
              placeholderTextColor="#BDBDBD"
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              textAlignVertical="top"
              maxLength={200}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleRejectSubmit}>
                <Text style={styles.modalConfirmText}>반려</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
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
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F5F5F5' },
  tabActive: { backgroundColor: '#1A1A1A' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '500' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 14, color: '#999' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#F0F0F0', padding: 16,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nickname: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  date: { fontSize: 11, color: '#999' },
  gifticonName: { fontSize: 13, color: '#444', marginBottom: 4 },
  pointCost: { fontSize: 13, color: '#1A1A1A', fontWeight: '600', marginBottom: 10 },
  reasonBox: { backgroundColor: '#F8F9FA', borderRadius: 8, padding: 10, marginBottom: 8 },
  reasonLabel: { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 3 },
  reason: { fontSize: 13, color: '#1A1A1A', lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#F5F5F5' },
  rejectText: { fontSize: 14, fontWeight: '600', color: '#666' },
  approveBtn: { backgroundColor: '#1A1A1A' },
  approveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  modalInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1A1A',
    minHeight: 80, marginBottom: 12,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#666' },
  modalConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#FF3B30', alignItems: 'center' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
