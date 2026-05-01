import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchInquiryById, type Inquiry } from '../../services/api';

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '답변대기', color: '#FF9500', bg: 'rgba(255,149,0,0.12)' },
  answered: { label: '답변완료', color: '#FFFFFF', bg: '#1A1A1A' },
  closed:   { label: '종료',     color: '#999',    bg: '#F2F2F2' },
};

export default function InquiryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchInquiryById(id)
      .then(setInquiry)
      .catch(() => setInquiry(null))
      .finally(() => setLoading(false));
  }, [id]));

  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>문의 상세</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : !inquiry ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>문의를 찾을 수 없습니다</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: STATUS_BADGE[inquiry.status]?.bg || '#F2F2F2' }]}>
              <Text style={[styles.badgeText, { color: STATUS_BADGE[inquiry.status]?.color || '#999' }]}>
                {STATUS_BADGE[inquiry.status]?.label || inquiry.status}
              </Text>
            </View>
            <Text style={styles.category}>{inquiry.category || '일반'}</Text>
          </View>

          <Text style={styles.title}>{inquiry.title}</Text>
          <Text style={styles.date}>{formatDateTime(inquiry.createdAt)}</Text>

          <View style={styles.divider} />

          <Text style={styles.content}>{inquiry.content}</Text>

          {inquiry.adminReply ? (
            <View style={styles.replyBox}>
              <View style={styles.replyHeader}>
                <Ionicons name="return-down-forward" size={16} color="#1A1A1A" />
                <Text style={styles.replyAuthor}>{inquiry.repliedBy || '관리자'}</Text>
                <Text style={styles.replyBadge}>운영자 답변</Text>
                <Text style={styles.replyDate}>{formatDateTime(inquiry.repliedAt)}</Text>
              </View>
              <Text style={styles.replyContent}>{inquiry.adminReply}</Text>
            </View>
          ) : (
            <View style={styles.waitingBox}>
              <Ionicons name="time-outline" size={18} color="#FF9500" />
              <Text style={styles.waitingText}>답변을 준비 중입니다. 영업일 기준 1~3일 내 답변드릴게요.</Text>
            </View>
          )}
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  category: { fontSize: 12, color: '#666', fontWeight: '600' },

  title: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 6 },
  date: { fontSize: 12, color: '#999', marginBottom: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#EEE', marginBottom: 16 },
  content: { fontSize: 14, color: '#333', lineHeight: 22 },

  replyBox: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  replyAuthor: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  replyBadge: {
    fontSize: 10, color: '#FFFFFF',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: '700',
  },
  replyDate: { fontSize: 11, color: '#999', marginLeft: 'auto' },
  replyContent: { fontSize: 14, color: '#333', lineHeight: 21 },

  waitingBox: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8E1',
    padding: 14,
    borderRadius: 8,
  },
  waitingText: { fontSize: 13, color: '#666', flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 14, color: '#999' },
});
