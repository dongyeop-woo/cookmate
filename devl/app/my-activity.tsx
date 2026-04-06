import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './_layout';
import { fetchCommunityRecipes } from '../services/api';
import type { CommunityRecipe } from '../constants/community';

export default function MyActivityScreen() {
  const router = useRouter();
  const { userProfile, firebaseUser } = useAuth();
  const [myRecipes, setMyRecipes] = useState<CommunityRecipe[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<CommunityRecipe[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes'>('posts');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const all = await fetchCommunityRecipes();
          const authorName = userProfile?.nickname || firebaseUser?.displayName || '';
          setMyRecipes(authorName ? all.filter(r => r.author === authorName) : []);

          const likedIds = userProfile?.likedRecipes || [];
          setLikedRecipes(all.filter(r => likedIds.includes(r.id)));
        } catch (e) {
          console.warn('활동 로드 실패:', e);
        }
      })();
    }, [firebaseUser?.uid])
  );

  const data = activeTab === 'posts' ? myRecipes : likedRecipes;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 활동</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{myRecipes.length}</Text>
          <Text style={styles.statLabel}>작성한 글</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{likedRecipes.length}</Text>
          <Text style={styles.statLabel}>좋아요한 글</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{userProfile?.bookmarkedRecipes?.length ?? 0}</Text>
          <Text style={styles.statLabel}>저장한 레시피</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
          onPress={() => setActiveTab('posts')}
        >
          <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>작성한 글</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'likes' && styles.tabActive]}
          onPress={() => setActiveTab('likes')}
        >
          <Text style={[styles.tabText, activeTab === 'likes' && styles.tabTextActive]}>좋아요한 글</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {data.length > 0 ? (
          data.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push(`/recipe/${recipe.id}?type=community`)}
            >
              {recipe.image ? (
                <Image source={{ uri: recipe.image }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, styles.cardPlaceholder]}>
                  <Text style={{ fontSize: 24 }}>🍳</Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={1}>{recipe.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{recipe.description}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>♡ {recipe.likes || 0}</Text>
                  <Text style={styles.cardMetaText}>{recipe.createdAt ? formatDate(recipe.createdAt) : ''}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {activeTab === 'posts' ? '작성한 글이 없습니다.' : '좋아요한 글이 없습니다.'}
            </Text>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
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
  backBtn: { fontSize: 24, color: '#1A1A1A' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: '#F0F0F0' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1A1A1A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#BBB' },
  tabTextActive: { color: '#1A1A1A' },
  card: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: 10,
  },
  cardPlaceholder: {
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', gap: 12 },
  cardMetaText: { fontSize: 12, color: '#BBB' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#999' },
});
