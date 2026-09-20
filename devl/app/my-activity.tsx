import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { fetchCommunityRecipes, fetchRecipes, fetchUser, fetchReviewsByUser, deleteReview, type Review } from '../services/api';
import type { CommunityRecipe } from '../constants/community';
import type { Recipe } from '../constants/recipes';
import { Alert } from 'react-native';

function isCommunityRecipe(r: Recipe | CommunityRecipe): r is CommunityRecipe {
  return !!(r as CommunityRecipe).authorUid;
}

type Tab = 'posts' | 'likes' | 'reviews';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '검토중',   color: '#FF9500', bg: 'transparent' },
  approved: { label: '승인완료', color: '#1A1A1A', bg: 'transparent' },
  rejected: { label: '반려',     color: '#FF3B30', bg: 'transparent' },
};

export default function MyActivityScreen() {
  const router = useRouter();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: Tab }>();
  const { userProfile, firebaseUser } = useAuth();
  const [myPosts, setMyPosts] = useState<(Recipe | CommunityRecipe)[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<(Recipe | CommunityRecipe)[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [recipeTitleMap, setRecipeTitleMap] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'posts');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const uid = firebaseUser?.uid || '';
          const authorName = userProfile?.nickname || firebaseUser?.displayName || '';

          // 서버에서 최신 프로필을 다시 가져와 liked/bookmarked IDs 동기화
          const [freshProfile, communityList, regularList] = await Promise.all([
            uid ? fetchUser(uid) : Promise.resolve(null),
            fetchCommunityRecipes(),
            fetchRecipes(),
          ]);

          const likedSet = new Set<string>(freshProfile?.likedRecipes ?? userProfile?.likedRecipes ?? []);
          const bookmarkedSet = new Set<string>(freshProfile?.likedRecipes ?? userProfile?.likedRecipes ?? []);

          const myCommunity = communityList.filter(r =>
            (uid && r.authorUid === uid) || (authorName && r.author === authorName)
          );
          const myRegular = authorName
            ? regularList.filter(r => r.author === authorName)
            : [];
          setMyPosts([...myRegular, ...myCommunity]);
          setLikedRecipes([
            ...regularList.filter(r => likedSet.has(r.id)),
            ...communityList.filter(r => likedSet.has(r.id)),
          ]);
          setSavedRecipes(regularList.filter(r => bookmarkedSet.has(r.id)));

          // 내가 쓴 후기 + 각 후기의 레시피 제목 매핑
          if (uid) {
            try {
              const reviews = await fetchReviewsByUser(uid);
              reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
              setMyReviews(reviews);
              const titleMap: Record<string, string> = {};
              [...regularList, ...communityList].forEach(r => { titleMap[r.id] = r.title; });
              setRecipeTitleMap(titleMap);
            } catch (e) {
              console.warn('후기 로드 실패:', e);
            }
          }
        } catch (e) {
          console.warn('활동 로드 실패:', e);
        }
      })();
    }, [firebaseUser?.uid, userProfile?.nickname])
  );

  const filteredPosts = activeTab === 'posts'
    ? myPosts.filter(r => {
        if (statusFilter === 'all') return true;
        const status = (r as CommunityRecipe).status;
        if (statusFilter === 'approved') return !status || status === 'approved';
        return status === statusFilter;
      })
    : [];

  const data: (Recipe | CommunityRecipe)[] =
    activeTab === 'posts' ? filteredPosts :
    activeTab === 'likes' ? likedRecipes :
    savedRecipes;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 활동</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{myPosts.length}</Text>
          <Text style={styles.statLabel}>작성한 글</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{likedRecipes.length}</Text>
          <Text style={styles.statLabel}>좋아요한 글</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{myReviews.length}</Text>
          <Text style={styles.statLabel}>후기</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'posts', label: '작성한 글' },
          { key: 'likes', label: '좋아요' },
          { key: 'reviews', label: '후기' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            onPress={() => { setActiveTab(key); setStatusFilter('all'); }}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 상태 필터 (작성한 글 탭에서만) */}
      {activeTab === 'posts' && (
        <View style={styles.statusFilterRow}>
          {([
            { key: 'all',      label: '전체' },
            { key: 'pending',  label: '검토중' },
            { key: 'approved', label: '승인완료' },
            { key: 'rejected', label: '반려' },
          ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.statusFilterBtn, statusFilter === key && styles.statusFilterBtnActive]}
              onPress={() => setStatusFilter(key)}
            >
              <Text style={[styles.statusFilterText, statusFilter === key && styles.statusFilterTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {activeTab === 'reviews' ? (
        <FlatList
          data={myReviews}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const title = recipeTitleMap[item.recipeId] || '레시피';
            return (
              <View style={styles.reviewCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/review/[recipeId]', params: { recipeId: item.recipeId, recipeTitle: title } })}
                  style={{ flexDirection: 'row' }}
                >
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.reviewImage} cachePolicy="disk" />
                  ) : null}
                  <View style={[styles.reviewBody, !item.photoUrl && { marginLeft: 0 }]}>
                    <Text style={styles.reviewRecipeTitle} numberOfLines={1}>{title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      {[1,2,3,4,5].map(n => (
                        <Ionicons key={n} name={(item.rating || 0) >= n ? 'star' : 'star-outline'} size={12} color="#FFB800" />
                      ))}
                      <Text style={styles.reviewDate}>  {formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.reviewContent} numberOfLines={2}>{item.content}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    onPress={() => router.push({
                      pathname: '/review/write',
                      params: {
                        recipeId: item.recipeId,
                        recipeTitle: title,
                        reviewId: item.id,
                        initialContent: item.content,
                        initialRating: String(item.rating || 0),
                        initialPhotoUrl: item.photoUrl,
                      },
                    })}
                  >
                    <Text style={styles.reviewActionText}>수정</Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#E0E0E0' }}>|</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('후기 삭제', '정말 삭제하시겠어요?', [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '삭제', style: 'destructive',
                          onPress: async () => {
                            try {
                              await deleteReview(item.id);
                              setMyReviews(prev => prev.filter(r => r.id !== item.id));
                            } catch (e: any) {
                              Alert.alert('삭제 실패', e.message || '다시 시도해주세요.');
                            }
                          },
                        },
                      ]);
                    }}
                  >
                    <Text style={[styles.reviewActionText, { color: '#FF3B30' }]}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>작성한 후기가 없습니다.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      ) : activeTab === 'likes' ? (
      <FlatList
        key="likes-grid"
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={4}
        windowSize={5}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item: recipe }) => (
          <TouchableOpacity
            style={styles.gridCard}
            activeOpacity={0.85}
            onPress={() => router.push(`/recipe/${recipe.id}`)}
          >
            {recipe.image ? (
              <Image source={{ uri: recipe.image }} style={styles.gridCardImage} cachePolicy="disk" recyclingKey={recipe.id} contentFit="cover" />
            ) : (
              <View style={[styles.gridCardImage, styles.cardPlaceholder]}>
                <Text style={{ fontSize: 24 }}>🍳</Text>
              </View>
            )}
            <View style={styles.gridCardBody}>
              <Text style={styles.gridCardTitle} numberOfLines={1}>{recipe.title}</Text>
              <View style={styles.gridCardMeta}>
                <Ionicons name="star" size={11} color="#FFB800" />
                <Text style={styles.gridCardMetaText}>{((recipe as any).reviewAvgRating ?? 0).toFixed(1)} ({(recipe as any).reviewCount ?? 0})</Text>
                <Text style={styles.gridCardDot}>·</Text>
                <Ionicons name="heart" size={11} color="#FF6B6B" />
                <Text style={styles.gridCardMetaText}>{recipe.likes || 0}</Text>
                <Text style={styles.gridCardDot}>·</Text>
                <Text style={styles.gridCardMetaText} numberOfLines={1}>{recipe.author}</Text>
              </View>
              <View style={styles.gridCardMeta}>
                <Ionicons name="flame-outline" size={11} color="#BDBDBD" />
                <Text style={styles.gridCardMetaText}>{(recipe as any).calories ?? 0}kcal</Text>
                <Text style={styles.gridCardDot}>·</Text>
                <Ionicons name="time-outline" size={11} color="#BDBDBD" />
                <Text style={styles.gridCardMetaText}>{(recipe as any).time ?? 0}분</Text>
                <Text style={styles.gridCardDot}>·</Text>
                <Text style={[styles.gridCardMetaText, { color: (recipe as any).difficulty === '쉬움' ? '#1BAE74' : (recipe as any).difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{(recipe as any).difficulty ?? ''}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>저장한 글이 없습니다.</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />
      ) : (
      <FlatList
        key="posts-grid"
        data={data}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={4}
        windowSize={5}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item: recipe }) => {
          const isCommunity = isCommunityRecipe(recipe);
          const status = isCommunity ? (recipe as CommunityRecipe).status : undefined;
          const rejectionReason = isCommunity ? (recipe as CommunityRecipe).rejectionReason : undefined;
          const badge = status ? STATUS_BADGE[status] : null;
          return (
            <TouchableOpacity
              style={styles.gridCard}
              activeOpacity={0.85}
              onPress={() => router.push(`/recipe/${recipe.id}${isCommunity ? '?type=community' : ''}`)}
            >
              <View>
                {recipe.image ? (
                  <Image source={{ uri: recipe.image }} style={styles.gridCardImage} cachePolicy="disk" recyclingKey={recipe.id} contentFit="cover" />
                ) : (
                  <View style={[styles.gridCardImage, styles.cardPlaceholder]}>
                    <Text style={{ fontSize: 24 }}>🍳</Text>
                  </View>
                )}
                {badge && (
                  <View style={[styles.gridStatusBadge, { backgroundColor: badge.color }]}>
                    <Text style={styles.gridStatusBadgeText}>{badge.label}</Text>
                  </View>
                )}
              </View>
              <View style={styles.gridCardBody}>
                <Text style={styles.gridCardTitle} numberOfLines={1}>{recipe.title}</Text>
                {status === 'rejected' && rejectionReason ? (
                  <Text style={styles.rejectionReason} numberOfLines={1}>사유: {rejectionReason}</Text>
                ) : null}
                <View style={styles.gridCardMeta}>
                  <Ionicons name="star" size={11} color="#FFB800" />
                  <Text style={styles.gridCardMetaText}>{((recipe as any).reviewAvgRating ?? 0).toFixed(1)} ({(recipe as any).reviewCount ?? 0})</Text>
                  <Text style={styles.gridCardDot}>·</Text>
                  <Ionicons name="heart" size={11} color="#FF6B6B" />
                  <Text style={styles.gridCardMetaText}>{recipe.likes || 0}</Text>
                  <Text style={styles.gridCardDot}>·</Text>
                  <Text style={styles.gridCardMetaText} numberOfLines={1}>
                    {(recipe as CommunityRecipe).createdAt ? formatDate((recipe as CommunityRecipe).createdAt) : ''}
                  </Text>
                </View>
                <View style={styles.gridCardMeta}>
                  <Ionicons name="flame-outline" size={11} color="#BDBDBD" />
                  <Text style={styles.gridCardMetaText}>{(recipe as any).calories ?? 0}kcal</Text>
                  <Text style={styles.gridCardDot}>·</Text>
                  <Ionicons name="time-outline" size={11} color="#BDBDBD" />
                  <Text style={styles.gridCardMetaText}>{(recipe as any).time ?? 0}분</Text>
                  <Text style={styles.gridCardDot}>·</Text>
                  <Text style={[styles.gridCardMetaText, { color: (recipe as any).difficulty === '쉬움' ? '#1BAE74' : (recipe as any).difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{(recipe as any).difficulty ?? ''}</Text>
                </View>
                {status === 'rejected' && (
                  <TouchableOpacity
                    onPress={() => router.push(`/community/write?resubmitId=${recipe.id}`)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={styles.resubmitBtn}>수정하기</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {activeTab === 'posts' ? '작성한 글이 없습니다.' : '후기가 없습니다.'}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
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
  statItem: { flex: 1, alignItems: 'center' },
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
  statusFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  statusFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  statusFilterBtnActive: { backgroundColor: '#1A1A1A' },
  statusFilterText: { fontSize: 12, fontWeight: '600', color: '#999' },
  statusFilterTextActive: { color: '#fff' },
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
  gridCard: {
    flex: 1,
    maxWidth: '48%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  gridCardImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  gridCardBody: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 2,
  },
  gridCardTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 18,
  },
  gridCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
  },
  gridCardMetaText: {
    fontSize: 11,
    color: '#9E9E9E',
  },
  gridCardDot: {
    fontSize: 11,
    color: '#DCDCDC',
  },
  gridStatusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gridStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  cardDesc: { fontSize: 13, color: '#888', lineHeight: 18, marginBottom: 6 },
  rejectionReason: { fontSize: 12, color: '#FF3B30', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 2 },
  cardMetaText: { fontSize: 12, color: '#BBB' },
  resubmitBtn: { fontSize: 12, fontWeight: '700', color: '#1A1A1A' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#999' },
  reviewCard: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  reviewImage: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#F5F5F5' },
  reviewBody: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  reviewRecipeTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  reviewDate: { fontSize: 12, color: '#999' },
  reviewContent: { fontSize: 13, color: '#666', lineHeight: 18, marginTop: 4 },
  reviewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  reviewActionText: { fontSize: 13, color: '#666', fontWeight: '600' },
});
