import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { fetchRecipes, fetchTopUsers } from '../../services/api';
import type { UserProfile } from '../../services/api';
import type { Recipe } from '../../constants/recipes';

const defaultAvatarMale = require('../../assets/man.png');
const defaultAvatarFemale = require('../../assets/girl.png');

const isValidImageUri = (uri?: string) => !!uri && uri !== 'default' && (uri.startsWith('https://') || uri.startsWith('http://'));

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2;
const CATEGORIES = ['전체', '아침', '점심', '저녁', '디저트', '간식', '음료'];

export default function RecipeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [sortBy, setSortBy] = useState<'popular' | 'latest' | 'time'>('popular');
  const [activeTab, setActiveTab] = useState<'recipe' | 'chef'>('recipe');
  const [chefs, setChefs] = useState<UserProfile[]>([]);
  const [chefsLoading, setChefsLoading] = useState(false);
  const router = useRouter();

  const loadRecipes = async () => {
    try {
      const data = await fetchRecipes();
      setRecipes(data);
    } catch (e) {
      console.warn('레시피 로드 실패:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRecipes();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecipes();
    setRefreshing(false);
  };

  const switchToChef = async () => {
    setActiveTab('chef');
    setChefsLoading(true);
    try {
      const users = await fetchTopUsers(30);
      console.log('[셰프탭] 유저 profileImage 값들:', users.map(u => ({ nickname: u.nickname, profileImage: u.profileImage })));
      setChefs(users);
    } catch (e) {
      console.warn('셰프 로드 실패:', e);
    } finally {
      setChefsLoading(false);
    }
  };

  const filteredRecipes = recipes.filter(
    (r) => selectedCategory === '전체' || r.category === selectedCategory
  );

  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    if (sortBy === 'popular') return (b.likes || 0) - (a.likes || 0);
    if (sortBy === 'time') return a.time - b.time;
    return (b.rating || 0) - (a.rating || 0);
  });

  const renderItem = ({ item: recipe }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
    >
      {recipe.image ? (
        <Image source={{ uri: recipe.image }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={styles.placeholderEmoji}>🍳</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{recipe.title}</Text>
        <Text style={styles.cardMeta}>{recipe.time}분 · {recipe.difficulty}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardLikes}>♥ {recipe.likes || 0}</Text>
          <Text style={styles.cardBookmarks}>☆ {recipe.bookmarks || 0}</Text>
          <Text style={styles.cardComments}>✎ {Array.isArray(recipe.comments) ? recipe.comments.length : (recipe.comments || 0)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => setActiveTab('recipe')} activeOpacity={0.7}>
            <Text style={activeTab === 'recipe' ? styles.headerTitle : styles.headerTitleInactive}>레시피</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={switchToChef} activeOpacity={0.7}>
            <Text style={activeTab === 'chef' ? styles.headerTitle : styles.headerTitleInactive}>셰프</Text>
          </TouchableOpacity>
        </View>
        {activeTab === 'recipe' && (
          <View style={styles.sortRow}>
            {([
              { key: 'popular' as const, label: '인기' },
              { key: 'latest' as const, label: '평점' },
              { key: 'time' as const, label: '시간' },
            ]).map((s) => (
              <TouchableOpacity
                key={s.key}
                onPress={() => setSortBy(s.key)}
                style={styles.sortBtn}
              >
                <Text style={[styles.sortBtnText, sortBy === s.key && styles.sortBtnTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {activeTab === 'recipe' ? (
        <>
          {/* Category Tabs */}
          <View style={styles.categoryRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Recipe Grid */}
          <FlatList
            data={sortedRecipes}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0B9A61" />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>레시피가 없어요</Text>
              </View>
            }
          />

          {/* 레시피 작성 FAB */}
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => router.push('/community/write')}
          >
            <Text style={styles.fabText}>+ 레시피 작성</Text>
          </TouchableOpacity>
        </>
      ) : chefsLoading ? (
        <ActivityIndicator size="large" color="#0B9A61" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={chefs}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
          renderItem={({ item, index }) => {
            const userRank = item.role === 'admin'
              ? null
              : chefs.slice(0, index).filter(c => c.role !== 'admin').length + 1;
            return (
            <TouchableOpacity style={styles.chefRow} activeOpacity={0.7} onPress={() => router.push(`/profile/${item.uid}`)}>
              <View style={styles.chefRank}>
                {userRank != null ? (
                  <Text style={styles.chefRankText}>{userRank}</Text>
                ) : (
                  <Text style={styles.chefRankText}>★</Text>
                )}
              </View>
              {isValidImageUri(item.profileImage) ? (
                <Image source={{ uri: item.profileImage }} style={styles.chefAvatar} />
              ) : (
                <Image source={item.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale} style={styles.chefAvatar} />
              )}
              <View style={styles.chefInfo}>
                <View style={styles.chefNameRow}>
                  <Text style={styles.chefName}>{item.nickname || '요리사'}</Text>
                  {item.role === 'admin' && (
                    <View style={styles.officialBadge}>
                      <Text style={styles.officialBadgeText}>공식</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chefBio} numberOfLines={1}>
                  {item.bio || '맛있는 요리를 만들어요'}
                </Text>
              </View>
              <View style={styles.chefStats}>
                <Text style={styles.chefFollowers}>팔로워 {item.followers?.length ?? 0}</Text>
              </View>
            </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ fontSize: 15, color: '#999' }}>셰프가 없어요</Text>
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
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortBtnText: {
    fontSize: 14,
    color: '#BDBDBD',
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#1A1A1A',
  },
  categoryRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  categoryChipActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    backgroundColor: '#F5F5F5',
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: { fontSize: 32 },
  cardBody: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 20,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardRating: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F5A623',
  },
  cardLikes: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  cardBookmarks: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  cardComments: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#999' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0B9A61',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Header left
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  headerTitleInactive: {
    fontSize: 26,
    fontWeight: '800',
    color: '#CDCDCD',
    letterSpacing: -0.5,
  },

  // Chef List
  chefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  chefRank: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  chefRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#BDBDBD',
  },
  chefAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  chefInfo: {
    flex: 1,
  },
  chefNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chefName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  officialBadge: {
    backgroundColor: '#0B9A61',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chefBio: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  chefStats: {
    alignItems: 'flex-end',
  },
  chefFollowers: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
});
