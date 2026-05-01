import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { fetchMyInquiries, filterAfterRejoin, type Inquiry } from '../../services/api';

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '답변대기', color: '#1A1A1A', bg: '#FFFFFF' },
  answered: { label: '답변완료', color: '#FFFFFF', bg: '#1A1A1A' },
  closed:   { label: '종료',     color: '#999',    bg: '#F2F2F2' },
};

export default function MyInquiriesScreen() {
  const router = useRouter();
  const { firebaseUser, userProfile } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!firebaseUser?.uid) return;
    setLoading(true);
    fetchMyInquiries(firebaseUser.uid)
      .then((data) => setInquiries(filterAfterRejoin(data, userProfile?.rejoinedAt)))
      .catch(() => setInquiries([]))
      .finally(() => setLoading(false));
  }, [firebaseUser?.uid, userProfile?.rejoinedAt]));

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 문의내역</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : (
        <FlatList
          data={inquiries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push(`/inquiry/${item.id}`)}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                  <Text style={styles.category}>{item.category || '일반'}</Text>
                  <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.preview} numberOfLines={2}>{item.content}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color="#DDD" />
              <Text style={styles.emptyText}>아직 문의 내역이 없어요</Text>
            </View>
          }
        />
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  card: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  category: { fontSize: 12, color: '#666', fontWeight: '600' },
  date: { fontSize: 11, color: '#999', marginLeft: 'auto' },
  title: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  preview: { fontSize: 13, color: '#888', lineHeight: 18 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 14, color: '#999', marginTop: 4 },

  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1BAE74',
    paddingVertical: 16,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
