import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { fetchUserGifticons, requestRefund, filterAfterRejoin, type UserGifticon } from '../services/api';

export default function MyGifticonsScreen() {
  const router = useRouter();
  const { firebaseUser, userProfile } = useAuth();
  const [gifticons, setGifticons] = useState<UserGifticon[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserGifticon | null>(null);
  const [filter, setFilter] = useState<'available' | 'used' | 'refunded'>('available');

  const load = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    try {
      const data = await fetchUserGifticons(firebaseUser.uid);
      // 재가입 유저는 rejoinedAt 이후 교환한 기프티콘만 노출
      setGifticons(filterAfterRejoin(data, userProfile?.rejoinedAt));
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.uid, userProfile?.rejoinedAt]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = gifticons.filter(g => {
    if (filter === 'available') return !g.used && !g.refunded;
    if (filter === 'used') return g.used && !g.refunded;
    if (filter === 'refunded') return g.refunded;
    return false;
  });

  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  // iOS는 모달 2개 동시 표시 불가라 환불 대상을 별도로 저장하고 상세 모달을 닫음
  const [refundTarget, setRefundTarget] = useState<UserGifticon | null>(null);
  // 모달 전환 지연 타이머 — 언마운트 시 정리
  const refundOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (refundOpenTimerRef.current) clearTimeout(refundOpenTimerRef.current);
  }, []);

  const handleRefundOpen = () => {
    if (!selected) return;
    setRefundTarget(selected);
    setRefundReason('');
    setSelected(null);
    // 상세 모달 닫힘 애니메이션 끝난 뒤 환불 모달 띄우기 (iOS 모달 스태킹 회피)
    if (refundOpenTimerRef.current) clearTimeout(refundOpenTimerRef.current);
    refundOpenTimerRef.current = setTimeout(() => setRefundModalVisible(true), 350);
  };

  const handleRefundSubmit = async () => {
    if (!refundTarget || !firebaseUser?.uid) return;
    if (refundReason.trim().length < 5) {
      Alert.alert('안내', '환불 사유를 5자 이상 입력해주세요.');
      return;
    }
    try {
      await requestRefund(firebaseUser.uid, refundTarget.id, refundReason.trim());
      setRefundModalVisible(false);
      setRefundTarget(null);
      Alert.alert('환불 요청 완료', '관리자 승인 후 포인트가 환급됩니다.\n처리 결과는 알림으로 안내드려요.');
      load();
    } catch (e: any) {
      Alert.alert('환불 요청 실패', e.message || '잠시 후 다시 시도해주세요.');
    }
  };

  const downloadImage = async (url: string, name: string): Promise<string | null> => {
    try {
      const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
      const fileUri = (FileSystem as any).cacheDirectory + `gifticon_${name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${Date.now()}.${ext}`;
      const download = (FileSystem as any).createDownloadResumable
        ? await (FileSystem as any).createDownloadResumable(url, fileUri).downloadAsync()
        : await (FileSystem as any).downloadAsync(url, fileUri);
      return download?.uri || null;
    } catch (e) {
      console.warn('이미지 다운로드 실패:', e);
      return null;
    }
  };

  const handleSaveToGallery = async () => {
    if (!selected?.couponImageUrl) {
      Alert.alert('안내', '저장할 이미지가 없습니다.');
      return;
    }
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
        return;
      }
      const localUri = await downloadImage(selected.couponImageUrl, selected.name);
      if (!localUri) {
        Alert.alert('저장 실패', '이미지를 다운로드하지 못했습니다.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert('저장 완료', '갤러리에 저장되었어요!');
    } catch (e: any) {
      Alert.alert('저장 실패', e.message || '잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 기프티콘</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, filter === 'available' && styles.tabActive]}
          onPress={() => setFilter('available')}
        >
          <Text style={[styles.tabText, filter === 'available' && styles.tabTextActive]}>사용 가능</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'used' && styles.tabActive]}
          onPress={() => setFilter('used')}
        >
          <Text style={[styles.tabText, filter === 'used' && styles.tabTextActive]}>사용 완료</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'refunded' && styles.tabActive]}
          onPress={() => setFilter('refunded')}
        >
          <Text style={[styles.tabText, filter === 'refunded' && styles.tabTextActive]}>환불</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={48} color="#DDD" />
              <Text style={styles.emptyText}>
                {filter === 'available' ? '사용 가능한 기프티콘이 없어요' : filter === 'used' ? '사용 완료된 기프티콘이 없어요' : '환불된 기프티콘이 없어요'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.used && { opacity: 0.55 }]}
              onPress={() => setSelected(item)}
              activeOpacity={0.8}
            >
              {item.brandIcon ? (
                <Image source={{ uri: item.brandIcon }} style={styles.brandIcon} contentFit="cover" />
              ) : (
                <View style={[styles.brandIcon, { backgroundColor: '#F0F0F0' }]} />
              )}
              <View style={styles.cardBody}>
                <Text style={styles.brandName} numberOfLines={1}>{item.brand}</Text>
                <Text style={styles.goodsName} numberOfLines={1}>{item.name}</Text>
                {!!item.createdAt && (() => {
                  const exchangedAt = new Date(item.createdAt);
                  const exchangeLabel = `${exchangedAt.getFullYear()}.${String(exchangedAt.getMonth() + 1).padStart(2, '0')}.${String(exchangedAt.getDate()).padStart(2, '0')}`;
                  if (item.used || item.refunded) {
                    return <Text style={styles.exchangeMeta}>교환일 {exchangeLabel}</Text>;
                  }
                  const msPerDay = 86400000;
                  const daysSince = Math.floor((Date.now() - exchangedAt.getTime()) / msPerDay);
                  const daysLeft = 3 - daysSince;
                  const refundLabel = daysLeft > 0 ? `환불 가능 D-${daysLeft}` : '환불 기간 만료';
                  return (
                    <Text style={styles.exchangeMeta}>
                      교환일 {exchangeLabel} · <Text style={daysLeft > 0 ? styles.refundActive : styles.refundExpired}>{refundLabel}</Text>
                    </Text>
                  );
                })()}
                {!!item.validPeriod && (
                  <Text style={styles.validPeriod}>유효기간 ~ {item.validPeriod}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#BDBDBD" />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.overlay}>
          <View style={styles.detailCard}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)} hitSlop={10}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>

            <Text style={styles.detailBrand}>{selected?.brand}</Text>
            <Text style={styles.detailName} numberOfLines={2}>{selected?.name}</Text>

            {selected?.couponImageUrl ? (
              <View style={styles.couponImageWrap}>
                <Image source={{ uri: selected.couponImageUrl }} style={styles.couponImage} contentFit="contain" />
                {!selected?.refunded && !selected?.used && (
                  <TouchableOpacity onPress={handleSaveToGallery} activeOpacity={0.7} hitSlop={8} style={styles.saveBtn}>
                    <Ionicons name="download-outline" size={16} color="#1A1A1A" />
                    <Text style={styles.saveBtnText}>갤러리 저장</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={[styles.couponImage, { backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="barcode-outline" size={60} color="#BDBDBD" />
              </View>
            )}

            {!!selected?.pinNo && (
              <View style={styles.pinBox}>
                <Text style={styles.pinLabel}>교환 번호</Text>
                <View style={styles.pinRow}>
                  <Text style={styles.pinNumber} selectable>{selected.pinNo}</Text>
                  <TouchableOpacity
                    onPress={async () => {
                      await Clipboard.setStringAsync(selected.pinNo!);
                      Alert.alert('복사 완료', '교환 번호가 복사되었어요.');
                    }}
                    hitSlop={10}
                    style={styles.pinCopyBtn}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="copy-outline" size={18} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!!selected?.validPeriod && (
              <Text style={styles.detailValid}>유효기간 ~ {selected.validPeriod}</Text>
            )}

            {selected?.refunded ? (
              <View style={styles.usedBadge}>
                <Text style={styles.usedBadgeText}>환불 완료됨</Text>
              </View>
            ) : selected?.refundPending ? (
              <View style={styles.usedBadge}>
                <Text style={styles.usedBadgeText}>환불 처리중</Text>
              </View>
            ) : !selected?.used ? (
              <View style={styles.actionRow}>
                <View style={styles.availableBadge}>
                  <Text style={styles.availableBadgeText}>사용 가능</Text>
                </View>
                <TouchableOpacity style={styles.refundRedBtn} onPress={handleRefundOpen} activeOpacity={0.7}>
                  <Text style={styles.refundRedBtnText}>환불 신청</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.usedBadge}>
                <Text style={styles.usedBadgeText}>사용 완료됨</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={refundModalVisible} transparent animationType="fade" onRequestClose={() => { setRefundModalVisible(false); setRefundTarget(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.refundOverlay}>
          <View style={styles.refundCard}>
            <Text style={styles.refundTitle}>환불 사유를 입력해주세요</Text>
            <Text style={styles.refundSub}>• 교환 후 3일 이내에만 신청 가능{'\n'}• 사용하지 않은 기프티콘만 환불 가능{'\n'}• 검토 후 영업일 기준 1일 이내 처리 (주말·공휴일 제외)</Text>
            <TextInput
              style={styles.refundInput}
              placeholder="환불 사유를 5자 이상 입력"
              placeholderTextColor="#BDBDBD"
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
              textAlignVertical="top"
              maxLength={200}
              autoFocus
            />
            <Text style={styles.refundCount}>{refundReason.length}/200</Text>
            <View style={styles.refundBtnRow}>
              <TouchableOpacity style={styles.refundCancelBtn} onPress={() => { setRefundModalVisible(false); setRefundTarget(null); }}>
                <Text style={styles.refundCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.refundConfirmBtn} onPress={handleRefundSubmit}>
                <Text style={styles.refundConfirmText}>환불 요청</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  backBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  tabActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF', fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    gap: 14,
  },
  brandIcon: { width: 52, height: 52, borderRadius: 10 },
  cardBody: { flex: 1 },
  brandName: { fontSize: 12, color: '#9E9E9E', fontWeight: '600', marginBottom: 2 },
  goodsName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  exchangeMeta: { fontSize: 11, color: '#666', marginTop: 4 },
  refundActive: { color: '#1BAE74', fontWeight: '700' },
  refundExpired: { color: '#9E9E9E' },
  validPeriod: { fontSize: 11, color: '#999', marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, color: '#999' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  detailCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 12, right: 12, padding: 6, zIndex: 1 },
  detailBrand: { fontSize: 13, color: '#9E9E9E', fontWeight: '600', marginTop: 6 },
  detailName: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginTop: 4, textAlign: 'center' },
  couponImageWrap: {
    width: '100%',
    marginVertical: 16,
    position: 'relative',
  },
  couponImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  pinBox: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    marginBottom: 10,
  },
  pinLabel: { fontSize: 12, color: '#9E9E9E', marginBottom: 4 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinNumber: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', letterSpacing: 1.5 },
  pinCopyBtn: { padding: 2 },
  detailValid: { fontSize: 12, color: '#999', marginBottom: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  availableBadge: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  usedBadge: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    marginTop: 4,
  },
  usedBadgeText: { color: '#9E9E9E', fontWeight: '700', fontSize: 15 },
  saveBtn: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  refundRedBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
  },
  refundRedBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  refundOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  refundCard: {
    width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF',
    borderRadius: 16, padding: 24,
  },
  refundTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 10 },
  refundSub: { fontSize: 12, color: '#666', lineHeight: 19, marginBottom: 16 },
  refundInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1A1A',
    minHeight: 100,
  },
  refundCount: { fontSize: 11, color: '#999', textAlign: 'right', marginTop: 4 },
  refundBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  refundCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  refundCancelText: { fontSize: 15, fontWeight: '600', color: '#666' },
  refundConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    backgroundColor: '#FF3B30', alignItems: 'center',
  },
  refundConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
