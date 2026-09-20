import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchCookingDropoff, type CookingDropoff } from '../../services/api';

export default function AdminCookingDropoffScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CookingDropoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchCookingDropoff());
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
        <Text style={styles.title}>요리모드 이탈 지점</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.recipeId}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={
            <View style={styles.helper}>
              <Text style={styles.helperText}>
                단계별 진입/완료 비율. 이탈률이 높은 스텝은 설명이 불명확하거나 어려울 수 있음.
              </Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>아직 수집된 이벤트가 없어요.</Text>}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <RecipeCard recipe={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function RecipeCard({ recipe }: { recipe: CookingDropoff }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {recipe.recipeTitle || recipe.recipeId}
      </Text>
      <View style={{ marginTop: 10, gap: 8 }}>
        {recipe.steps.map(step => (
          <View key={step.step} style={styles.stepRow}>
            <Text style={styles.stepLabel}>Step {step.step}</Text>
            <View style={styles.barWrap}>
              <View style={[styles.barCompleted, { flex: step.complete || 0.01 }]} />
              <View style={[styles.barDropped, { flex: Math.max(step.enter - step.complete, 0) || 0.01 }]} />
            </View>
            <Text style={styles.stepMeta}>
              {step.complete}/{step.enter}
              {step.enter > 0 && (
                <Text style={[
                  styles.dropRate,
                  step.dropoffRate > 0.3 && { color: '#E53935' }
                ]}>
                  {' · '}이탈 {(step.dropoffRate * 100).toFixed(0)}%
                </Text>
              )}
            </Text>
          </View>
        ))}
      </View>
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
  title: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  helper: { paddingBottom: 12 },
  helperText: { fontSize: 12, color: '#8E8E93' },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 60 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLabel: { fontSize: 11, color: '#5A5A5F', fontWeight: '700', width: 50 },
  barWrap: {
    flex: 1, flexDirection: 'row', height: 10, borderRadius: 4, overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  barCompleted: { backgroundColor: '#1BAE74' },
  barDropped: { backgroundColor: '#FFCDD2' },
  stepMeta: { fontSize: 10, color: '#8E8E93', fontWeight: '700', minWidth: 80, textAlign: 'right' },
  dropRate: { color: '#FF9500' },
});
