import React, { useState, useCallback, useMemo, useEffect, useTransition, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { fetchRecipes, fetchTopUsers, fetchUser, likeRecipeUser, unlikeRecipeUser, fetchCommunityRecipes } from '../../services/api';
import { useAuth } from '../_layout';
import type { Recipe } from '../../constants/recipes';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import { isRemoteProfileImage } from '../../services/profileImage';

const isValidImageUri = isRemoteProfileImage;

const CATEGORIES = ['전체', '아침', '점심', '저녁', '디저트', '간식', '음료', '야식', '분식', '한식', '양식'];

const hiResImage = (uri: string, w = 800) => {
  if (!uri) return uri;
  if (uri.includes('unsplash.com')) {
    if (/[?&]w=\d+/.test(uri)) return uri.replace(/[?&]w=\d+/, `?w=${w}`);
    return `${uri}${uri.includes('?') ? '&' : '?'}w=${w}&q=85&fm=jpg`;
  }
  return uri;
};

const defaultAvatarAsset = require('../../assets/logo-removebg-preview.png');

type TimeFilter = 'all' | 'u10' | 'u15' | 'u30' | 'u60';
type DifficultyFilter = 'all' | '쉬움' | '보통' | '어려움';
type CalorieFilter = 'all' | 'u200' | 'u300' | 'u500';

const TIME_OPTIONS: { key: TimeFilter; label: string; max?: number }[] = [
  { key: 'all', label: '전체' },
  { key: 'u10', label: '10분 이하', max: 10 },
  { key: 'u15', label: '15분 이하', max: 15 },
  { key: 'u30', label: '30분 이하', max: 30 },
  { key: 'u60', label: '1시간 이하', max: 60 },
];
const DIFFICULTY_OPTIONS: { key: DifficultyFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: '쉬움', label: '쉬움' },
  { key: '보통', label: '보통' },
  { key: '어려움', label: '어려움' },
];
const CAL_OPTIONS: { key: CalorieFilter; label: string; max?: number }[] = [
  { key: 'all', label: '전체' },
  { key: 'u200', label: '200kcal 이하', max: 200 },
  { key: 'u300', label: '300kcal 이하', max: 300 },
  { key: 'u500', label: '500kcal 이하', max: 500 },
];


const RecipeCard = React.memo(({ recipe, router, authorImage, isLiked, onLike }: { recipe: Recipe; router: ReturnType<typeof useRouter>; authorImage?: string; isLiked?: boolean; onLike?: () => void }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
    >
      <View style={styles.cardImageWrap}>
        {recipe.image ? (
          <Image source={{ uri: hiResImage(recipe.image, 800) }} style={[styles.cardImage, { aspectRatio: 4/5 }]} cachePolicy="disk" recyclingKey={recipe.id} contentFit="cover" priority="high" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder, { aspectRatio: 4/5 }]}>
            <Text style={styles.placeholderEmoji}>🍳</Text>
          </View>
        )}
        <TouchableOpacity style={styles.cardBookmarkBtn} onPress={onLike} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? '#FF4D67' : '#fff'} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{recipe.title}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Ionicons name="star" size={11} color="#FFB800" />
          <Text style={styles.cardLikes}>{(recipe.reviewAvgRating ?? 0).toFixed(1)}</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Ionicons name="heart" size={11} color="#FF6B6B" />
          <Text style={styles.cardLikes}>{recipe.likes || 0}</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Image
            source={authorImage ? { uri: authorImage } : defaultAvatarAsset}
            style={styles.cardAuthorInlineAvatar}
            contentFit="cover"
          />
          <Text style={[styles.cardLikes, { flexShrink: 1 }]} numberOfLines={1}>{recipe.author}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.cardLikes, { color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]} numberOfLines={1}>{recipe.difficulty}</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Ionicons name="time-outline" size={11} color="#BBB" />
          <Text style={styles.cardLikes} numberOfLines={1}>{recipe.time}분</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Text style={styles.cardLikes} numberOfLines={1}>{(recipe as any).calories ?? 0}kcal</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) => prev.recipe.id === next.recipe.id && prev.recipe.likes === next.recipe.likes && prev.isLiked === next.isLiked);

export default function RecipeScreen() {
  const { firebaseUser, userProfile, setUserProfile } = useAuth();
  const params = useLocalSearchParams<{ category?: string; tag?: string; ingredients?: string; _t?: string }>();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showFab, setShowFab] = useState(true);
  const recipeListRef = useRef<ScrollView>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const likePendingRef = useRef<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  useEffect(() => {
    if (params.category && CATEGORIES.includes(params.category)) {
      setSelectedCategory(params.category);
    }
  }, [params.category, params._t]);

  useEffect(() => {
    if (typeof params.ingredients === 'string' && params.ingredients.length > 0) {
      const list = params.ingredients.split(',').map(s => s.trim()).filter(Boolean);
      setSelectedIngredients(list);
    } else {
      setSelectedIngredients([]);
    }
  }, [params.ingredients, params._t]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [calorieFilter, setCalorieFilter] = useState<CalorieFilter>('all');
  // 기본은 최신순. 인기순으로 두면 새로 올린 레시피가 목록 아래로 묻혀,
  // 매일 올리는 신규 레시피가 사실상 노출되지 않는다.
  const [sortType, setSortType] = useState<'인기순' | '최신순'>('최신순');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const activeFilterCount = (timeFilter !== 'all' ? 1 : 0) + (difficultyFilter !== 'all' ? 1 : 0) + (calorieFilter !== 'all' ? 1 : 0);
  const [authorImages, setAuthorImages] = useState<Record<string, string>>({});
  const [toastVisible, setToastVisible] = useState(false);
  // toast 자동 닫기 타이머 — 재발화 시 이전 타이머 취소 + 언마운트 시 정리
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);
  const router = useRouter();

  const loadData = async () => {
    try {
      const uid = firebaseUser?.uid;
      const [recipeData, communityData, users, fresh] = await Promise.all([
        fetchRecipes(),
        fetchCommunityRecipes(),
        fetchTopUsers(30),
        uid ? fetchUser(uid) : null,
      ]);
      // 승인된 커뮤니티 레시피도 함께 표시 (차단된 사용자 제외)
      const blockedUids = ((fresh as any)?.blockedUids ?? []) as string[];
      const approvedCommunity = communityData.filter(r => r.status === 'approved' && (!r.authorUid || !blockedUids.includes(r.authorUid))).map(r => ({
        id: r.id,
        title: r.title,
        author: r.author,
        time: r.time,
        difficulty: r.difficulty,
        calories: (r as any).calories || 0,
        rating: r.ratings?.length ? r.ratings.reduce((s, x) => s + x.score, 0) / r.ratings.length : 0,
        likes: r.likes ?? 0,
        image: r.image,
        category: r.category,
        description: r.description,
        ingredients: r.ingredients.map((i: any) => ({ ...i, icon: '' })),
        steps: r.steps.map((s: any, idx: number) => ({ step: idx + 1, description: s.description, time: s.time })),
        reviewCount: (r as any).reviewCount ?? 0,
        reviewAvgRating: (r as any).reviewAvgRating ?? 0,
        createdAt: (r as any).approvedAt || r.createdAt,
        tags: r.tags ?? [],
      }));
      // createdAt 기준 최신순 정렬
      const combined = [...recipeData, ...approvedCommunity];
      combined.sort((a, b) => {
        const A = (a as any).createdAt || '';
        const B = (b as any).createdAt || '';
        return B.localeCompare(A);
      });
      setRecipes(combined);
      if (fresh) setLikedIds(new Set(fresh.likedRecipes ?? []));
      const map: Record<string, string> = {};
      for (const u of users) {
        if (u.nickname && u.profileImage && isValidImageUri(u.profileImage)) {
          map[u.nickname] = u.profileImage;
        }
      }
      setAuthorImages(map);
      // 첫 화면에 보일 카드 이미지 prefetch — 디스크 캐시 워밍 (백그라운드)
      try {
        const urls = combined.slice(0, 30).map(r => hiResImage(r.image, 800)).filter(Boolean);
        if (urls.length) Image.prefetch(urls, 'disk');
      } catch {}
    } catch (e) {
      console.warn('레시피 로드 실패:', e);
    } finally {
      setInitialLoading(false);
    }
  };

  const toggleLike = useCallback(async (recipeId: string) => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    if (likePendingRef.current.has(recipeId)) return;
    likePendingRef.current.add(recipeId);

    let isLiked = false;
    setLikedIds(prev => {
      isLiked = prev.has(recipeId);
      const next = new Set(prev);
      isLiked ? next.delete(recipeId) : next.add(recipeId);
      return next;
    });
    setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, likes: (r.likes || 0) + (isLiked ? -1 : 1) } : r));
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        likedRecipes: isLiked
          ? (userProfile.likedRecipes || []).filter(rid => rid !== recipeId)
          : [...(userProfile.likedRecipes || []), recipeId],
      });
    }
    if (!isLiked) {
      setToastVisible(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
    }
    try {
      if (isLiked) await unlikeRecipeUser(uid, recipeId);
      else await likeRecipeUser(uid, recipeId);
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        isLiked ? next.add(recipeId) : next.delete(recipeId);
        return next;
      });
      setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, likes: (r.likes || 0) + (isLiked ? 1 : -1) } : r));
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          likedRecipes: isLiked
            ? [...(userProfile.likedRecipes || []), recipeId]
            : (userProfile.likedRecipes || []).filter(rid => rid !== recipeId),
        });
      }
    } finally {
      likePendingRef.current.delete(recipeId);
    }
  }, [firebaseUser?.uid, userProfile, setUserProfile]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLogoPress = useCallback(() => {
    (recipeListRef.current as any)?.scrollToOffset?.({ offset: 0, animated: true });
    loadData();
  }, []);

  // 1) 먼저 전체 recipes를 정렬 (sortType/recipes만 바뀔 때 재계산)
  const allSortedRecipes = useMemo(() => [...recipes].sort((a, b) => {
    if (sortType === '최신순') {
      const A = (a as any).createdAt || '';
      const B = (b as any).createdAt || '';
      return B.localeCompare(A);
    }
    return (b.likes || 0) - (a.likes || 0);
  }), [recipes, sortType]);

  // 2) 정렬된 배열을 필터만 적용 (카테고리 전환 시 O(n) 필터만 실행)
  const sortedRecipes = useMemo(() => {
    const timeOpt = TIME_OPTIONS.find(o => o.key === timeFilter);
    const calOpt = CAL_OPTIONS.find(o => o.key === calorieFilter);
    const tagFilter = params.tag?.trim();
    const ingFilters = selectedIngredients.map(s => s.toLowerCase());
    const filtered = allSortedRecipes.filter((r) => {
      if (selectedCategory !== '전체' && r.category !== selectedCategory) return false;
      if (timeOpt?.max && (r.time ?? 0) > timeOpt.max) return false;
      if (difficultyFilter !== 'all' && r.difficulty !== difficultyFilter) return false;
      if (calOpt?.max && ((r as any).calories ?? 9999) > calOpt.max) return false;
      if (tagFilter && !((r as any).tags ?? []).includes(tagFilter)) return false;
      if (ingFilters.length > 0) {
        // 양방향 부분 일치: "동원 돼지고기"(유저) ↔ "돼지고기"(레시피) 모두 매칭
        const recipeIngNames: string[] = (r.ingredients ?? []).map((ri: any) => (ri.name ?? '').toLowerCase());
        const hasAny = ingFilters.some(ing =>
          recipeIngNames.some(rn => rn.length > 0 && (rn.includes(ing) || ing.includes(rn)))
        );
        if (!hasAny) return false;
      }
      return true;
    });
    // 재료 필터 활성 시 매칭 개수 많은 순으로 재정렬
    if (ingFilters.length > 0) {
      const score = (r: Recipe) => {
        const recipeIngNames: string[] = (r.ingredients ?? []).map((ri: any) => (ri.name ?? '').toLowerCase());
        return ingFilters.reduce((acc, ing) =>
          acc + (recipeIngNames.some(rn => rn.length > 0 && (rn.includes(ing) || ing.includes(rn))) ? 1 : 0), 0);
      };
      return [...filtered].sort((a, b) => score(b) - score(a));
    }
    return filtered;
  }, [allSortedRecipes, selectedCategory, timeFilter, difficultyFilter, calorieFilter, params.tag, selectedIngredients]);

  const availableTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allSortedRecipes) {
      if (selectedCategory !== '전체' && r.category !== selectedCategory) continue;
      for (const t of (((r as any).tags ?? []) as string[])) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([t]) => t);
  }, [allSortedRecipes, selectedCategory]);

  const renderRecipeItem = useCallback(({ item }: { item: Recipe }) => (
    <View style={{ flex: 1, maxWidth: '50%' }}>
      <RecipeCard
        recipe={item}
        router={router}
        authorImage={authorImages[item.author]}
        isLiked={likedIds.has(item.id)}
        onLike={() => toggleLike(item.id)}
      />
    </View>
  ), [router, authorImages, likedIds, toggleLike]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Fixed Header (홈과 동일) */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Image source={require('../../assets/appIcon-padded.png')} style={styles.topHeaderLogo} />
        </TouchableOpacity>
        <LinearGradient
          colors={['#A8E8C4', '#5FB896']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.topHeaderSearchGradient}
        >
          <TouchableOpacity style={styles.topHeaderSearchBar} activeOpacity={0.7} onPress={() => router.push('/search')}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={11} cy={11} r={8} />
              <Line x1={21} y1={21} x2={16.65} y2={16.65} />
            </Svg>
            <Text style={styles.topHeaderSearchText}>레시피, 재료, 셰프 검색</Text>
          </TouchableOpacity>
        </LinearGradient>
        <TouchableOpacity onPress={() => router.push('/notifications')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.topHeaderBell}>
          <Ionicons name="notifications-outline" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>


      <View style={{ flex: 1 }}>
          {params.tag ? (
            <View style={styles.tagFilterBanner}>
              <Text style={styles.tagFilterText}>#{params.tag}</Text>
              <TouchableOpacity
                onPress={() => router.setParams({ tag: undefined, _t: String(Date.now()) } as any)}
                hitSlop={8}
              >
                <Ionicons name="close" size={14} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          ) : null}
          {/* Category Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabsRow}
            contentContainerStyle={styles.categoryTabsContent}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryTab}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text style={[styles.categoryTabText, selectedCategory === cat && styles.categoryTabTextActive]}>
                  {cat}
                </Text>
                {selectedCategory === cat && <View style={styles.categoryTabIndicator} />}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tag Chips */}
          {!params.tag && availableTags.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tagChipScroll}
              contentContainerStyle={styles.tagChipRow}
            >
              {availableTags.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={styles.tagChipInline}
                  onPress={() => router.setParams({ tag: t, _t: String(Date.now()) } as any)}
                >
                  <Text style={styles.tagChipInlineText} numberOfLines={1} allowFontScaling={false}>#{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 재료 필터 배너 */}
          {selectedIngredients.length > 0 ? (
            <View style={styles.ingredientFilterBanner}>
              <Text style={styles.ingredientFilterLabel}>재료</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, alignItems: 'center' }}
                style={{ flex: 1 }}
              >
                {selectedIngredients.map((ing) => (
                  <TouchableOpacity
                    key={ing}
                    style={styles.ingredientFilterChip}
                    onPress={() => setSelectedIngredients(prev => prev.filter(i => i !== ing))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.ingredientFilterChipText} numberOfLines={1}>{ing}</Text>
                    <Ionicons name="close" size={11} color="#1A1A1A" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                onPress={() => {
                  setSelectedIngredients([]);
                  router.setParams({ ingredients: undefined, _t: String(Date.now()) } as any);
                }}
                hitSlop={8}
              >
                <Text style={styles.ingredientFilterClear}>초기화</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Modal
            visible={showFilterMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowFilterMenu(false)}
          >
            <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={() => setShowFilterMenu(false)}>
              <TouchableOpacity activeOpacity={1} style={styles.filterModal} onPress={() => {}}>
                <View style={styles.filterHeader}>
                  <Text style={styles.filterTitle}>필터</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => { setTimeFilter('all'); setDifficultyFilter('all'); setCalorieFilter('all'); }}
                      hitSlop={8}
                    >
                      <Text style={styles.filterResetText}>초기화</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowFilterMenu(false)} hitSlop={8}>
                      <Ionicons name="close" size={22} color="#1A1A1A" />
                    </TouchableOpacity>
                  </View>
                </View>
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.filterSectionLabel}>조리 시간</Text>
                  <View style={styles.filterChipRow}>
                    {TIME_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.filterChip, timeFilter === opt.key && styles.filterChipActive]}
                        onPress={() => setTimeFilter(opt.key)}
                      >
                        <Text style={[styles.filterChipText, timeFilter === opt.key && styles.filterChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.filterSectionLabel}>난이도</Text>
                  <View style={styles.filterChipRow}>
                    {DIFFICULTY_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.filterChip, difficultyFilter === opt.key && styles.filterChipActive]}
                        onPress={() => setDifficultyFilter(opt.key)}
                      >
                        <Text style={[styles.filterChipText, difficultyFilter === opt.key && styles.filterChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.filterSectionLabel}>칼로리</Text>
                  <View style={styles.filterChipRow}>
                    {CAL_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.filterChip, calorieFilter === opt.key && styles.filterChipActive]}
                        onPress={() => setCalorieFilter(opt.key)}
                      >
                        <Text style={[styles.filterChipText, calorieFilter === opt.key && styles.filterChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* Recipe Grid */}
          <FlatList
            ref={recipeListRef as any}
            data={sortedRecipes}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={styles.masonryContainer}
            ListHeaderComponent={
              <View style={styles.filterRow}>
                <Text style={styles.resultCount}>{sortedRecipes.length}개의 레시피</Text>
                <View style={styles.filterButtons}>
                  <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => setSortType(sortType === '인기순' ? '최신순' : '인기순')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-vertical" size={14} color="#1A1A1A" style={{ marginRight: 4 }} />
                    <Text style={styles.sortButtonText}>{sortType}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sortButton}
                    onPress={() => setShowFilterMenu(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="options-outline" size={14} color="#1A1A1A" style={{ marginRight: 4 }} />
                    <Text style={[styles.sortButtonText, activeFilterCount > 0 && styles.activeFilterText]}>
                      {activeFilterCount > 0 ? `필터 ${activeFilterCount}` : '필터'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A1A1A" />}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              const h = e.nativeEvent.layoutMeasurement.height;
              setShowScrollTop(y > 300);
              setShowFab(y < h / 2);
            }}
            scrollEventThrottle={100}
            removeClippedSubviews={Platform.OS === 'android'}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            updateCellsBatchingPeriod={50}
            windowSize={5}
            renderItem={renderRecipeItem}
            ListEmptyComponent={
              initialLoading ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="small" color="#1A1A1A" />
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>레시피가 없어요</Text>
                </View>
              )
            }
            ListFooterComponent={<View style={{ height: 80 }} />}
          />

          {/* 레시피 작성 FAB */}
          {showFab && (
            <TouchableOpacity
              style={styles.fab}
              activeOpacity={0.85}
              onPress={() => router.push('/community/write')}
            >
              <Ionicons name="create-outline" size={26} color="#FFFFFF" style={{ marginLeft: 3, marginTop: -2 }} />
            </TouchableOpacity>
          )}
      </View>
      {toastVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>좋아요 했어요.</Text>
          <TouchableOpacity style={styles.toastBtnWrap} onPress={() => { setToastVisible(false); router.push(`/(tabs)/profile?tab=saved&_t=${Date.now()}`); }}>
            <Text style={styles.toastBtn}>좋아요 보기</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Scroll to Top 버튼 */}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopBtn}
          activeOpacity={0.8}
          onPress={() => {
            (recipeListRef.current as any)?.scrollToOffset?.({ offset: 0, animated: true });
          }}
        >
          <Ionicons name="arrow-up" size={20} color="#1A1A1A" />
        </TouchableOpacity>
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
    height: 56,
    marginTop: 10,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    marginTop: 10,
  },
  topHeaderLogo: {
    width: 50,
    height: 50,
  },
  topHeaderSearchGradient: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    padding: 1,
    marginLeft: 4,
    marginRight: 10,
  },
  topHeaderSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    paddingHorizontal: 14,
    gap: 8,
  },
  topHeaderSearchText: {
    flex: 1,
    fontSize: 14,
    color: '#6B6B6B',
  },
  topHeaderBell: {
    position: 'relative',
  },
  subTabRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  subTabItem: {
    paddingVertical: 4,
  },
  subTabActive: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subTabInactive: {
    fontSize: 20,
    fontWeight: '800',
    color: '#CDCDCD',
    letterSpacing: -0.5,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    minHeight: 32,
  },
  sortBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sortBtnText: {
    fontSize: 13,
    color: '#BDBDBD',
    fontWeight: '600',
  },
  sortBtnTextActive: {
    color: '#1A1A1A',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 14,
  },
  filterButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  resultCount: {
    fontSize: 13,
    color: '#BDBDBD',
    fontWeight: '500',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sortButtonText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  sortMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 100,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  sortMenuItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sortMenuItemActive: {
    backgroundColor: '#F8F8F8',
  },
  sortMenuText: {
    fontSize: 14,
    color: '#666',
  },
  sortMenuTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  filterModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  filterSectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 14,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: '#1A1A1A',
    backgroundColor: '#1A1A1A',
  },
  filterChipText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterResetText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  categoryRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryTabsRow: {
    flexGrow: 0,
    flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  categoryTabsContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tagChipScroll: {
    flexGrow: 0,
  },
  tagChipRow: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  tagChipInline: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F5F5F5',
    minHeight: 32,
    justifyContent: 'center',
  },
  tagChipInlineText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  tagFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
  },
  tagFilterText: { color: '#1A1A1A', fontSize: 12, fontWeight: '700' },
  ingredientFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E8F7EF',
    borderRadius: 8,
  },
  ingredientFilterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1BAE74',
  },
  ingredientFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ingredientFilterChipText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '600',
    maxWidth: 100,
  },
  ingredientFilterClear: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginLeft: 4,
  },
  categoryTab: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryTabText: {
    fontSize: 15,
    color: '#BDBDBD',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#1A1A1A',
    fontWeight: '900',
  },
  categoryTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
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
  masonryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  masonryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  masonryCol: {
    flex: 1,
    gap: 10,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  cardImageWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  cardImage: {
    width: '100%',
    backgroundColor: '#F5F5F5',
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: { fontSize: 32 },
  cardBookmarkBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBookmarkBtnActive: {},
  cardBody: {
    paddingHorizontal: 0,
    paddingBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
    flexShrink: 1,
  },
  cardStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexWrap: 'wrap',
  },
  cardRating: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
    marginLeft: 2,
  },
  cardMetaSub: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
    marginLeft: 2,
  },
  cardAuthor: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
    marginLeft: 2,
  },
  cardAuthorInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  cardAuthorInlineAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  cardAuthorInlineAvatarFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAuthorInline: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
  },
  cardAuthorOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  cardAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  cardAuthorAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAuthorName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    maxWidth: 50,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  cardLikes: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
  },
  cardMetaDot: {
    fontSize: 11,
    color: '#DCDCDC',
  },
  cardComments: {
    fontSize: 11,
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
  scrollTopBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(11, 154, 97, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  // Header left
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexShrink: 1,
  },
  headerTitleInactive: {
    fontSize: 22,
    fontWeight: '800',
    color: '#CDCDCD',
    letterSpacing: -0.5,
  },

  // Chef List
  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  podiumItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  podiumItemFirst: { transform: [{ translateY: -16 }] },
  crown: { fontSize: 24, marginBottom: -4 },
  podiumRank: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  podiumAvatarWrap: {
    borderRadius: 100,
    padding: 2,
    marginBottom: 8,
  },
  podiumAvatarWrapFirst: {},
  podiumName: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginBottom: 4, maxWidth: 100, textAlign: 'center' },
  podiumFollow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  podiumFollowText: { fontSize: 12, color: '#666', fontWeight: '600' },
  chefRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  chefRankCol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chefRankNumber: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  chefCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  chefCardAvatar: { width: 52, height: 52, borderRadius: 26 },
  chefCardInfo: { flex: 1, marginLeft: 14 },
  chefCardName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  chefCardHandle: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  chefCardStat: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  chefCardStatText: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
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
    backgroundColor: '#1A1A1A',
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
  chefSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  chefSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    paddingVertical: 0,
  },
  toast: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  toastBtnWrap: {
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toastBtn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
});
