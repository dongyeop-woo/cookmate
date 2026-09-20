import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchFailedSearches, type FailedSearch } from '../../services/api';

export default function AdminFailedSearchesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<FailedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchFailedSearches());
    } catch {
      Alert.alert('오류', '목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>검색 실패 쿼리</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.query}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View style={styles.helper}>
              <Text style={styles.helperText}>
                결과 0개로 끝난 검색어 Top 100. 반복 쿼리는 레시피/재료 추가 우선순위로 고려.
              </Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>아직 수집된 실패 쿼리가 없어요.</Text>}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.query}</Text>
                <Text style={styles.meta}>최근: {formatDate(item.lastSeenAt)}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.count}회</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  } catch { return '-'; }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ECECEC',
  },
  title: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  helper: { paddingBottom: 12 },
  helperText: { fontSize: 12, color: '#8E8E93' },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 60 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#ECECEC' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rank: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: 12, fontWeight: '800', color: '#1A1A1A' },
  name: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  meta: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  countBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#FF9500',
  },
  countText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});
