import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { fetchAllInquiries, replyInquiry, updateInquiryStatus, type Inquiry } from '../../services/api';

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '답변대기', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
  answered: { label: '답변완료', color: '#1A1A1A', bg: 'rgba(11,154,97,0.12)' },
  closed:   { label: '종료',     color: '#999',    bg: '#F2F2F2' },
};

type StatusFilter = 'all' | 'pending' | 'answered' | 'closed';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function AdminInquiriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyModal, setReplyModal] = useState<{ visible: boolean; inquiry: Inquiry | null }>({ visible: false, inquiry: null });
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  const filteredInquiries = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inquiries;
    return inquiries.filter(i => (i.authorNickname || '').toLowerCase().includes(q));
  }, [inquiries, searchQuery]);

  const load = useCallback(() => {
    setLoading(true);
    fetchAllInquiries(filter)
      .then(setInquiries)
      .catch(() => setInquiries([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const openReply = (inquiry: Inquiry) => {
    setReplyText(inquiry.adminReply || '');
    setReplyModal({ visible: true, inquiry });
  };

  const handleSubmitReply = async () => {
    if (!firebaseUser?.uid || !replyModal.inquiry) return;
    if (!replyText.trim()) {
      Alert.alert('답변 내용', '답변을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await replyInquiry(replyModal.inquiry.id, firebaseUser.uid, replyText.trim());
      setInquiries(prev => prev.map(i => i.id === updated.id ? updated : i));
      setReplyModal({ visible: false, inquiry: null });
      setReplyText('');
      Alert.alert('답변 등록 완료', '사용자에게 알림이 발송됐어요.');
    } catch (e: any) {
      Alert.alert('등록 실패', e.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (inquiry: Inquiry) => {
    Alert.alert('문의 종료', '이 문의를 종료 처리할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료',
        onPress: async () => {
          try {
            await updateInquiryStatus(inquiry.id, 'closed');
            setInquiries(prev => prev.map(i => i.id === inquiry.id ? { ...i, status: 'closed' } : i));
          } catch (e: any) {
            Alert.alert('실패', e.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>문의 관리</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            setSearchOpen((prev) => {
              if (prev) setSearchQuery('');
              return !prev;
            });
          }}
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

      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        {(['pending', 'answered', 'closed', 'all'] as StatusFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? '전체' : STATUS_BADGE[f]?.label || f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={filteredInquiries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  <Text style={styles.category}>{item.category || '일반'}</Text>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.author}>
                  {item.authorNickname || '익명'} {item.authorEmail ? `· ${item.authorEmail}` : ''}
                </Text>
                <Text style={styles.content} numberOfLines={3}>{item.content}</Text>

                {item.images && item.images.length > 0 ? (
                  <View style={styles.imageRow}>
                    {item.images.map((uri, idx) => (
                      <TouchableOpacity
                        key={`${uri}-${idx}`}
                        onPress={() => setExpandedPhoto(uri)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri }} style={styles.imageThumb} contentFit="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {item.adminReply ? (
                  <View style={styles.replyPreview}>
                    <Text style={styles.replyPreviewLabel}>답변:</Text>
                    <Text style={styles.replyPreviewText} numberOfLines={2}>{item.adminReply}</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openReply(item)}>
                    <Text style={styles.actionBtnText}>{item.adminReply ? '답변 수정' : '답변 작성'}</Text>
                  </TouchableOpacity>
                  {item.status !== 'closed' && (
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={() => handleClose(item)}>
                      <Text style={[styles.actionBtnText, { color: '#666' }]}>종료</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>해당하는 문의가 없어요</Text>
            </View>
          }
        />
      )}

      {/* 답변 모달 */}
      <Modal
        visible={replyModal.visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setReplyModal({ visible: false, inquiry: null })}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalCard, { paddingBottom: Math.max(30, insets.bottom + 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>답변 작성</Text>
              <TouchableOpacity onPress={() => setReplyModal({ visible: false, inquiry: null })}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            {replyModal.inquiry && (
              <View style={styles.modalQuestion}>
                <Text style={styles.modalQuestionTitle}>{replyModal.inquiry.title}</Text>
                <Text style={styles.modalQuestionContent} numberOfLines={3}>{replyModal.inquiry.content}</Text>
              </View>
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="답변 내용을 입력해주세요"
              placeholderTextColor="#AAA"
              multiline
              textAlignVertical="top"
              value={replyText}
              onChangeText={setReplyText}
            />
            <TouchableOpacity
              style={[styles.modalSubmit, submitting && { backgroundColor: '#BDBDBD' }]}
              onPress={handleSubmitReply}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitText}>답변 등록</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 이미지 확대 모달 */}
      <Modal
        visible={!!expandedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPhoto(null)}
        statusBarTranslucent
      >
        <View style={styles.zoomOverlay}>
          <TouchableOpacity
            style={styles.zoomClose}
            onPress={() => setExpandedPhoto(null)}
            hitSlop={10}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={() => setExpandedPhoto(null)}
          >
            {expandedPhoto && (
              <Image
                source={{ uri: expandedPhoto }}
                style={styles.zoomImage}
                contentFit="contain"
              />
            )}
          </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    padding: 0,
  },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5' },
  filterBtnActive: { backgroundColor: '#1A1A1A' },
  filterText: { fontSize: 12, color: '#999', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  category: { fontSize: 12, color: '#666', fontWeight: '600' },
  date: { fontSize: 11, color: '#999', marginLeft: 'auto' },
  title: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  author: { fontSize: 11, color: '#888', marginBottom: 8 },
  content: { fontSize: 13, color: '#444', lineHeight: 19 },

  imageRow: { flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  imageThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#F5F5F5' },

  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  zoomClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: { width: SCREEN_W, height: SCREEN_H },

  replyPreview: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
  replyPreviewLabel: { fontSize: 11, color: '#1A1A1A', fontWeight: '700', marginBottom: 2 },
  replyPreviewText: { fontSize: 12, color: '#666', lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnGhost: { backgroundColor: '#F5F5F5' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: '#999' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  modalQuestion: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalQuestionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  modalQuestionContent: { fontSize: 12, color: '#666', lineHeight: 17 },
  modalInput: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 12,
  },
  modalSubmit: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSubmitText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
