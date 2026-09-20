import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
  Animated,
  ActivityIndicator,
  InteractionManager,
  Keyboard,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';

const defaultAvatarMale = require('../assets/man.png');
const defaultAvatarFemale = require('../assets/girl.png');
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from './_layout';
import { isRemoteProfileImage } from '../services/profileImage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchRecipes,
  fetchCommunityRecipes,
  fetchGifticons,
  fetchTopUsers,
  fetchTrendingKeywords,
  logSearch,
  type TrendingKeyword,
  type Gifticon,
} from '../services/api';

const TRENDING_CACHE_KEY = 'trendingKeywordsCache';
const SEED_TRENDING: TrendingKeyword[] = [
  { keyword: '김치찌개', rank: 1, isNew: true, change: 'same' },
  { keyword: '비빔밥', rank: 2, isNew: true, change: 'same' },
  { keyword: '파스타', rank: 3, isNew: true, change: 'same' },
  { keyword: '샐러드', rank: 4, isNew: true, change: 'same' },
  { keyword: '닭가슴살', rank: 5, isNew: true, change: 'same' },
  { keyword: '다이어트', rank: 6, isNew: true, change: 'same' },
  { keyword: '에그타르트', rank: 7, isNew: true, change: 'same' },
  { keyword: '떡볶이', rank: 8, isNew: true, change: 'same' },
  { keyword: '김밥', rank: 9, isNew: true, change: 'same' },
  { keyword: '라면', rank: 10, isNew: true, change: 'same' },
];
import type { Recipe } from '../constants/recipes';

const RECENT_KEY = 'globalSearchRecent';
const MAX_RECENT = 12;

const PLACEHOLDERS = [
  '김치찌개',
  '비빔밥',
  '떡볶이',
  '파스타',
  '계란말이',
  '닭갈비',
  '된장찌개',
  '샐러드',
  '김밥',
  '라면',
];
// 마지막 글자 받침 유무로 을/를 선택
const josaEulReul = (word: string) => {
  if (!word) return '를';
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를';
  return (last - 0xac00) % 28 !== 0 ? '을' : '를';
};

const CATEGORIES: { key: string; label: string; icon: string; color: string; type: 'recipe' | 'shop'; image?: any; isMci?: boolean; emoji?: string }[] = [
  { key: '아침', label: '아침', icon: 'sunny-outline', color: '#FFB347', type: 'recipe', image: require('../assets/icons/categories/breakfast.png') },
  { key: '점심', label: '점심', icon: 'restaurant-outline', color: '#4FC3F7', type: 'recipe', image: require('../assets/icons/categories/lunch.png') },
  { key: '저녁', label: '저녁', icon: 'moon-outline', color: '#7986CB', type: 'recipe', image: require('../assets/icons/categories/dinner.png') },
  { key: '디저트', label: '디저트', icon: 'ice-cream-outline', color: '#F48FB1', type: 'recipe', image: require('../assets/icons/categories/dessert.png') },
  { key: '간식', label: '간식', icon: 'fast-food-outline', color: '#FFAB91', type: 'recipe', image: require('../assets/icons/categories/snack.png') },
  { key: '음료', label: '음료', icon: 'cafe-outline', color: '#A1887F', type: 'recipe', image: require('../assets/icons/categories/drink.png') },
  { key: '야식', label: '야식', icon: '', color: '#FF7043', type: 'recipe', image: require('../assets/icons/categories/midnight.png') },
  { key: '분식', label: '분식', icon: '', color: '#EF5350', type: 'recipe', image: require('../assets/icons/categories/street-food.png') },
  { key: '한식', label: '한식', icon: '', color: '#8D6E63', type: 'recipe', image: require('../assets/icons/categories/korean.png') },
  { key: '양식', label: '양식', icon: '', color: '#FFC107', type: 'recipe', image: require('../assets/icons/categories/western.png') },
  { key: '상품권', label: '상품권', icon: 'wallet-giftcard', color: '#C9A227', type: 'shop', isMci: true },
  { key: '카페', label: '카페', icon: 'coffee-outline', color: '#8B5E3C', type: 'shop', isMci: true },
  { key: '편의점', label: '편의점', icon: 'store-outline', color: '#1A73E8', type: 'shop', isMci: true },
  { key: '배달', label: '배달', icon: 'moped-outline', color: '#2AC1BC', type: 'shop', isMci: true },
  { key: '치킨', label: '치킨', icon: 'food-drumstick-outline', color: '#FF9800', type: 'shop', isMci: true },
  { key: '피자', label: '피자', icon: 'pizza', color: '#E53935', type: 'shop', isMci: true },
  { key: '버거', label: '버거', icon: 'hamburger', color: '#6D4C41', type: 'shop', isMci: true },
  { key: '베이커리', label: '베이커리', icon: 'bread-slice-outline', color: '#F5A623', type: 'shop', isMci: true },
  { key: '영화', label: '영화', icon: 'movie-open-outline', color: '#5C6BC0', type: 'shop', isMci: true },
  { key: '마트', label: '마트', icon: 'cart-outline', color: '#2E7D32', type: 'shop', isMci: true },
  { key: '기타', label: '기타', icon: 'dots-horizontal', color: '#999', type: 'shop', isMci: true },
];

type ResultTab = '통합' | '레시피' | '쇼핑' | '셰프';

type ChefItem = {
  uid: string;
  nickname: string;
  profileImage?: string;
  gender?: string;
  followersCount: number;
  recipeCount: number;
};

// ── 회전형 placeholder (페이드) ──
function AnimatedPlaceholder({ value }: { value: string }) {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (value) return;
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setIdx((i) => (i + 1) % PLACEHOLDERS.length);
        Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(t);
  }, [value, fade]);
  if (value) return null;
  return (
    <Animated.Text style={[styles.placeholderRotating, { opacity: fade }]} numberOfLines={1}>
      {`${PLACEHOLDERS[idx]}${josaEulReul(PLACEHOLDERS[idx])} 검색해보세요`}
    </Animated.Text>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const { userProfile } = useAuth();
  const blockedUids = ((userProfile as any)?.blockedUids ?? []) as string[];

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<ResultTab>('통합');
  const [recipeFilter, setRecipeFilter] = useState('전체');
  const [shopFilter, setShopFilter] = useState('전체');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const resultListRef = useRef<FlatList>(null);

  const RECIPE_CATS = ['전체', '아침', '점심', '저녁', '디저트', '간식', '음료', '야식', '분식', '한식', '양식'];
  const SHOP_CATS = ['전체', '상품권', '카페', '편의점', '배달', '치킨', '피자', '버거', '베이커리', '영화', '마트', '기타'];

  const [recent, setRecent] = useState<string[]>([]);
  const [trending, setTrending] = useState<TrendingKeyword[]>(SEED_TRENDING);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [gifticons, setGifticons] = useState<Gifticon[]>([]);
  const [chefs, setChefs] = useState<ChefItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // 캐시된 인기 검색어 즉시 표시 + 키보드 지연 포커스
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(TRENDING_CACHE_KEY);
        if (cached) setTrending(JSON.parse(cached));
      } catch {}
    })();
    if (!params.query && !params.category) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, []);

  // 랜딩에 필요한 데이터 로드 (화면 전환 완료 후)
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      (async () => {
        try {
          const [t, r, cr, g, users] = await Promise.all([
            fetchTrendingKeywords(),
            fetchRecipes(),
            fetchCommunityRecipes(),
            fetchGifticons(),
            fetchTopUsers(30),
          ]);
          if (t.length > 0) {
            setTrending(t);
            AsyncStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify(t)).catch(() => {});
          }
          const filteredCr = cr.filter(c => !c.authorUid || !blockedUids.includes(c.authorUid));
          const merged: Recipe[] = [...r, ...filteredCr.map(c => ({ ...c, rating: 0, __isCommunity: true } as unknown as Recipe))];
          if (merged.length > 0) setRecipes(merged);
          setGifticons(g);
          // 셰프별 레시피 수를 레시피 데이터에서 직접 카운트
          const authorCounts: Record<string, number> = {};
          for (const recipe of r) {
            if (recipe.author) authorCounts[recipe.author] = (authorCounts[recipe.author] || 0) + 1;
          }
          setChefs(users.map(u => ({
            uid: u.uid,
            nickname: u.nickname || '요리사',
            profileImage: u.profileImage,
            gender: (u as any).gender,
            followersCount: u.followers?.length ?? 0,
            recipeCount: (u as any).recipeCount || authorCounts[u.nickname || ''] || 0,
          })));
          dataLoadedRef.current = true;
          setDataLoading(false);
        } catch {}
      })();
    });
    return () => handle.cancel();
  }, []);

  // 검색 데이터는 검색 실행 시 최초 1회만 로드
  const dataLoadedRef = useRef(false);
  const loadSearchData = useCallback(async () => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;
    try {
      const [r, cr, g, users] = await Promise.all([
        fetchRecipes(),
        fetchCommunityRecipes(),
        fetchGifticons(),
        fetchTopUsers(30),
      ]);
      const filteredCr2 = cr.filter(c => !c.authorUid || !blockedUids.includes(c.authorUid));
      const merged: Recipe[] = [...r, ...filteredCr2.map(c => ({ ...c, rating: 0, __isCommunity: true } as unknown as Recipe))];
      setRecipes(merged);
      setGifticons(g);
      setChefs(users.map(u => ({
        uid: u.uid,
        nickname: u.nickname || '요리사',
        profileImage: u.profileImage,
        gender: (u as any).gender,
        followersCount: u.followers?.length ?? 0,
        recipeCount: (u as any).recipeCount ?? 0,
      })));
    } catch (e) {
      console.warn('search load 실패', e);
      dataLoadedRef.current = false;
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_KEY);
        if (raw) setRecent(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (params.query) {
      setInput(String(params.query));
      setQuery(String(params.query));
      loadSearchData();
    } else if (params.category) {
      setInput(String(params.category));
      setQuery(String(params.category));
      loadSearchData();
    }
  }, [params.query, params.category, loadSearchData]);

  const persistRecent = useCallback(async (term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecent(prev => {
      const next = [t, ...prev.filter(r => r !== t)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeRecent = useCallback((term: string) => {
    setRecent(prev => {
      const next = prev.filter(r => r !== term);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }, []);

  const submit = useCallback((term?: string) => {
    const t = (term ?? input).trim();
    if (!t) return;
    Keyboard.dismiss();
    setInput(t);
    setQuery(t);
    setTab('통합');
    persistRecent(t);
    logSearch(t, 'all');
    loadSearchData();
  }, [input, persistRecent, loadSearchData]);

  const browseCategory = useCallback((targetTab: ResultTab, filterValue: string) => {
    setQuery(' ');
    setInput('');
    setTab(targetTab);
    if (targetTab === '레시피') setRecipeFilter(filterValue);
    else if (targetTab === '쇼핑') setShopFilter(filterValue);
  }, []);

  // ── 검색 결과 ──
  const q = query.trim().toLowerCase();
  const qNoSpace = q.replace(/\s+/g, '');
  const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '');
  const isBrowsing = query === ' ';
  const recipeResultsBeforeTag = useMemo(() => {
    if (!q && !isBrowsing) return [];
    let list = isBrowsing ? [...recipes] : recipes.filter(r =>
      norm(r.title).includes(qNoSpace) ||
      norm(r.author).includes(qNoSpace) ||
      r.ingredients.some(ing => norm(ing.name).includes(qNoSpace)) ||
      norm(r.category || '').includes(qNoSpace) ||
      (((r as any).tags ?? []) as string[]).some(t => norm(t).includes(qNoSpace))
    );
    if (recipeFilter !== '전체') list = list.filter(r => r.category === recipeFilter);
    return list;
  }, [recipes, q, qNoSpace, isBrowsing, recipeFilter]);

  const availableTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of recipeResultsBeforeTag) {
      for (const t of ((r as any).tags ?? []) as string[]) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([t]) => t);
  }, [recipeResultsBeforeTag]);

  const recipeResults = useMemo(() => {
    if (!tagFilter) return recipeResultsBeforeTag;
    return recipeResultsBeforeTag.filter(r => ((r as any).tags ?? []).includes(tagFilter));
  }, [recipeResultsBeforeTag, tagFilter]);

  const shopResults = useMemo(() => {
    if (!q && !isBrowsing) return [];
    let list = isBrowsing ? [...gifticons] : gifticons.filter(g =>
      norm(g.name).includes(qNoSpace) ||
      norm(g.brand).includes(qNoSpace) ||
      norm(g.category || '').includes(qNoSpace)
    );
    if (shopFilter !== '전체') {
      const f = norm(shopFilter);
      list = list.filter(g =>
        norm(g.category || '').includes(f) ||
        norm(g.brand).includes(f) ||
        norm(g.name).includes(f)
      );
    }
    return list;
  }, [gifticons, q, qNoSpace, isBrowsing, shopFilter]);

  const chefResults = useMemo(() => {
    if (!q && !isBrowsing) return [];
    if (isBrowsing) return [...chefs];
    return chefs.filter(c => norm(c.nickname).includes(qNoSpace));
  }, [chefs, q, qNoSpace, isBrowsing]);

  const totalCount = recipeResults.length + shopResults.length + chefResults.length;

  const recipeHref = (r: Recipe) =>
    (r as any).__isCommunity ? `/recipe/${r.id}?type=community` : `/recipe/${r.id}`;

  // ── 추천 기획전 ──
  const featuredRecipes = useMemo(() => recipes.slice(0, 5), [recipes]);
  const authorImageMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of chefs) {
      if (c.nickname && c.profileImage && c.profileImage.startsWith('http')) {
        map[c.nickname] = c.profileImage;
      }
    }
    return map;
  }, [chefs]);

  // ── 카드 렌더러 ──
  const renderShopCard = useCallback(({ item }: { item: Gifticon }) => (
    <TouchableOpacity style={styles.shopGridCard} activeOpacity={0.85} onPress={() => router.push(`/gifticon/${item.id}` as any)}>
      <Image source={{ uri: item.image }} style={styles.shopGridImage} contentFit="cover" />
      <View style={styles.shopGridBody}>
        <Text style={styles.shopGridBrand}>{item.brand}</Text>
        <Text style={styles.shopGridName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.shopGridPrice}>{item.pointCost.toLocaleString()}P</Text>
      </View>
    </TouchableOpacity>
  ), [router]);

  const renderChefCard = useCallback(({ item }: { item: ChefItem }) => {
    const hasValidImage = isRemoteProfileImage(item.profileImage);
    return (
    <View style={styles.chefCard}>
      <View style={styles.chefAvatarWrap}>
        {hasValidImage ? (
          <Image source={{ uri: item.profileImage }} style={styles.chefAvatarInner} />
        ) : (
          <RNImage
            source={item.gender === 'female' ? defaultAvatarFemale : defaultAvatarMale}
            style={styles.chefAvatarInner}
          />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.chefName}>{item.nickname}</Text>
        <Text style={styles.chefMeta}>팔로워 {item.followersCount} · 레시피 {item.recipeCount}</Text>
      </View>
      <TouchableOpacity style={styles.chefProfileBtn} activeOpacity={0.7} onPress={() => router.push(`/profile/${item.uid}` as any)}>
        <Text style={styles.chefProfileBtnText}>프로필 보기</Text>
      </TouchableOpacity>
    </View>
    );
  }, [router]);

  const renderUnifiedSection = (title: string, count: number, onMore: () => void, children: React.ReactNode) => (
    count > 0 ? (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title} <Text style={styles.sectionCount}>{count}</Text></Text>
          {count > 3 && (
            <TouchableOpacity onPress={onMore} hitSlop={8}>
              <Text style={styles.sectionMore}>더보기 ›</Text>
            </TouchableOpacity>
          )}
        </View>
        {children}
      </View>
    ) : null
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* 검색 헤더 */}
      <View style={styles.searchRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <LinearGradient
          colors={['#A8E8C4', '#5FB896']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.searchBarGradient}
        >
          <View style={styles.searchBar}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={11} cy={11} r={8} />
              <Line x1={21} y1={21} x2={16.65} y2={16.65} />
            </Svg>
            <View style={{ flex: 1 }}>
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder=""
                value={input}
                onChangeText={(t) => { setInput(t); if (!t) setQuery(''); }}
                onSubmitEditing={() => submit()}
                returnKeyType="search"
                autoFocus={false}
              />
              <View pointerEvents="none" style={styles.placeholderOverlay}>
                <AnimatedPlaceholder value={input} />
              </View>
            </View>
            {input.length > 0 && (
              <TouchableOpacity onPress={() => { setInput(''); setQuery(''); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#BDBDBD" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      {!query ? (
        // ── 랜딩 ──
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 48) + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {recent.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>최근 검색어</Text>
                <TouchableOpacity onPress={clearRecent}><Text style={styles.sectionAction}>모두 지우기</Text></TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -20 }}
                contentContainerStyle={styles.horizontalChipRow}
              >
                {recent.map((term) => (
                  <View key={term} style={styles.chip}>
                    <TouchableOpacity onPress={() => submit(term)} activeOpacity={0.7}>
                      <Text style={styles.chipText}>{term}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeRecent(term)} hitSlop={6} style={{ marginLeft: 4 }}>
                      <Ionicons name="close" size={13} color="#9E9E9E" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* 인기 검색어 */}
          {trending.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>인기 검색어</Text>
                <Text style={styles.sectionAction}>실시간</Text>
              </View>
              <View style={styles.trendingGrid}>
                {trending.slice(0, 10).map((kw) => (
                  <TouchableOpacity
                    key={kw.rank}
                    style={styles.trendingItem}
                    onPress={() => submit(kw.keyword)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.trendingRank, kw.rank <= 3 && styles.trendingRankTop]}>{kw.rank}</Text>
                    <Text style={styles.trendingKeyword} numberOfLines={1}>{kw.keyword}</Text>
                    {kw.isNew ? (
                      <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                    ) : kw.change === 'up' ? (
                      <Ionicons name="caret-up" size={11} color="#FF3B30" />
                    ) : kw.change === 'down' ? (
                      <Ionicons name="caret-down" size={11} color="#3B82F6" />
                    ) : (
                      <View style={{ width: 11 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 추천 검색어 */}
          {/* 레시피 카테고리 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>레시피 카테고리</Text>
            </View>
            <View style={styles.categoryGrid}>
              {CATEGORIES.filter(c => c.type === 'recipe').map((cat) => (
                <TouchableOpacity key={cat.key} style={styles.categoryCell} onPress={() => browseCategory('레시피', cat.key)} activeOpacity={0.7}>
                  {cat.image ? (
                    <Image source={cat.image} style={styles.categoryImage} contentFit="contain" />
                  ) : cat.emoji ? (
                    <View style={styles.categoryEmojiWrap}>
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    </View>
                  ) : (
                    <View style={[styles.categoryIconWrap, { backgroundColor: cat.color + '1A' }]}>
                      {cat.isMci ? <MaterialCommunityIcons name={cat.icon as any} size={26} color={cat.color} /> : <Ionicons name={cat.icon as any} size={26} color={cat.color} />}
                    </View>
                  )}
                  <Text style={styles.categoryLabel} numberOfLines={1}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 쇼핑 카테고리 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>쇼핑 카테고리</Text>
            </View>
            <View style={styles.categoryGrid}>
              {CATEGORIES.filter(c => c.type === 'shop').map((cat) => (
                <TouchableOpacity key={cat.key} style={styles.categoryCell} onPress={() => browseCategory('쇼핑', cat.key)} activeOpacity={0.7}>
                  <View style={styles.shopCategoryIconWrap}>
                    {cat.isMci ? <MaterialCommunityIcons name={cat.icon as any} size={26} color={cat.color} /> : <Ionicons name={cat.icon as any} size={26} color={cat.color} />}
                  </View>
                  <Text style={styles.categoryLabel} numberOfLines={1}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>


          {/* 추천 기획전: 오늘의 추천 레시피 */}
          {featuredRecipes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>오늘의 추천 레시피</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
                {featuredRecipes.map((r) => (
                  <TouchableOpacity key={r.id} style={styles.featuredCard} activeOpacity={0.85} onPress={() => router.push(recipeHref(r) as any)}>
                    <Image source={{ uri: r.image }} style={styles.featuredImage} contentFit="cover" />
                    <Text style={styles.featuredTitle} numberOfLines={2}>{r.title}</Text>
                    <View style={styles.featuredMetaRow}>
                      <Ionicons name="star" size={11} color="#FFB800" />
                      <Text style={styles.featuredMeta}>{((r as any).reviewAvgRating ?? 0).toFixed(1)}</Text>
                      <Text style={styles.featuredDot}>·</Text>
                      <Ionicons name="heart" size={11} color="#FF6B6B" />
                      <Text style={styles.featuredMeta}>{r.likes || 0}</Text>
                      <Text style={styles.featuredDot}>·</Text>
                      {authorImageMap[r.author] ? (
                        <Image source={{ uri: authorImageMap[r.author] }} style={styles.featuredAuthorAvatar} />
                      ) : (
                        <View style={styles.featuredAuthorFallback}>
                          <Ionicons name="person" size={7} color="#999" />
                        </View>
                      )}
                      <Text style={styles.featuredMeta} numberOfLines={1}>{r.author}</Text>
                    </View>
                    <View style={styles.featuredMetaRow}>
                      <Text style={[styles.featuredMeta, { color: r.difficulty === '쉬움' ? '#1BAE74' : r.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{r.difficulty}</Text>
                      <Text style={styles.featuredDot}>·</Text>
                      <Ionicons name="time-outline" size={11} color="#BDBDBD" />
                      <Text style={styles.featuredMeta}>{r.time}분</Text>
                      <Text style={styles.featuredDot}>·</Text>
                      <Ionicons name="flame-outline" size={11} color="#BDBDBD" />
                      <Text style={styles.featuredMeta}>{(r as any).calories ?? 0}kcal</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

        </ScrollView>
      ) : (
        // ── 결과 ──
        <View style={{ flex: 1 }}>
          <View style={styles.tabRow}>
            {(['통합', '레시피', '쇼핑', '셰프'] as ResultTab[]).map((t) => {
              const count = t === '통합' ? totalCount
                : t === '레시피' ? recipeResults.length
                : t === '쇼핑' ? shopResults.length
                : chefResults.length;
              return (
                <TouchableOpacity key={t} style={[styles.tabItem, tab === t && styles.tabItemActive]} onPress={() => { setTab(t); setShowScrollTop(false); }}>
                  <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                    {t}{count > 0 ? ` ${count > 99 ? '99+' : count}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tab === '통합' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 48) + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {totalCount === 0 && dataLoading && (
                <View style={styles.emptyResults}>
                  <ActivityIndicator size="small" color="#1A1A1A" />
                </View>
              )}
              {totalCount === 0 && !dataLoading && (
                <View style={styles.emptyResults}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="search" size={36} color="#BDBDBD" />
                  </View>
                  <Text style={styles.emptyTitle}>'{query}' 검색 결과가 없어요</Text>
                  <Text style={styles.emptySub}>다른 키워드로 검색해보세요</Text>
                </View>
              )}
              {renderUnifiedSection('레시피', recipeResults.length, () => setTab('레시피'),
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
                  {recipeResults.slice(0, 6).map((r) => (
                    <TouchableOpacity key={r.id} style={styles.featuredCard} activeOpacity={0.85} onPress={() => router.push(recipeHref(r) as any)}>
                      <Image source={{ uri: r.image }} style={styles.featuredImage} contentFit="cover" />
                      <Text style={styles.featuredTitle} numberOfLines={2}>{r.title}</Text>
                      <View style={styles.featuredMetaRow}>
                        <Ionicons name="star" size={11} color="#FFB800" />
                        <Text style={styles.featuredMeta}>{((r as any).reviewAvgRating ?? 0).toFixed(1)}</Text>
                        <Text style={styles.featuredDot}>·</Text>
                        <Ionicons name="heart" size={11} color="#FF6B6B" />
                        <Text style={styles.featuredMeta}>{r.likes || 0}</Text>
                        <Text style={styles.featuredDot}>·</Text>
                        {authorImageMap[r.author] ? (
                          <Image source={{ uri: authorImageMap[r.author] }} style={styles.featuredAuthorAvatar} />
                        ) : null}
                        <Text style={styles.featuredMeta} numberOfLines={1}>{r.author}</Text>
                      </View>
                      <View style={styles.featuredMetaRow}>
                        <Text style={[styles.featuredMeta, { color: r.difficulty === '쉬움' ? '#1BAE74' : r.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{r.difficulty}</Text>
                        <Text style={styles.featuredDot}>·</Text>
                        <Ionicons name="time-outline" size={11} color="#BBB" />
                        <Text style={styles.featuredMeta}>{r.time}분</Text>
                        <Text style={styles.featuredDot}>·</Text>
                        <Text style={styles.featuredMeta}>{r.calories}kcal</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {renderUnifiedSection('쇼핑', shopResults.length, () => setTab('쇼핑'),
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
                  {shopResults.slice(0, 4).map((g) => (
                    <TouchableOpacity key={g.id} style={{ width: '48%' }} activeOpacity={0.85} onPress={() => router.push(`/gifticon/${g.id}` as any)}>
                      <Image source={{ uri: g.image }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#F5F5F5' }} contentFit="cover" />
                      <Text style={styles.featuredMeta} numberOfLines={1}>{g.brand}</Text>
                      <Text style={styles.featuredTitle} numberOfLines={2}>{g.name}</Text>
                      <Text style={[styles.featuredMeta, { fontWeight: '700', color: '#1A1A1A', fontSize: 13 }]}>{g.pointCost.toLocaleString()}P</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {renderUnifiedSection('셰프', chefResults.length, () => setTab('셰프'),
                <View style={{ marginHorizontal: -20 }}>{chefResults.slice(0, 3).map((c) => <View key={c.uid}>{renderChefCard({ item: c })}</View>)}</View>
              )}
            </ScrollView>
          )}

          {tab === '레시피' && (
            <FlatList data={recipeResults} keyExtractor={(item) => item.id}
              ref={resultListRef}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
              scrollEventThrottle={100}
              columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: Math.max(insets.bottom, 48) + 40 }}
              ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.shopGridCard, { maxWidth: '48%' }]} activeOpacity={0.85} onPress={() => router.push(recipeHref(item) as any)}>
                  <Image source={{ uri: item.image }} style={styles.shopGridImage} contentFit="cover" />
                  <View style={styles.shopGridBody}>
                    <Text style={styles.shopGridName} numberOfLines={1}>{item.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="star" size={11} color="#FFB800" />
                      <Text style={styles.shopGridBrand}>{((item as any).reviewAvgRating ?? 0).toFixed(1)}</Text>
                      <Text style={{ fontSize: 11, color: '#DCDCDC' }}>·</Text>
                      <Ionicons name="heart" size={11} color="#FF6B6B" />
                      <Text style={styles.shopGridBrand}>{item.likes || 0}</Text>
                      <Text style={{ fontSize: 11, color: '#DCDCDC' }}>·</Text>
                      {authorImageMap[item.author] ? (
                        <Image source={{ uri: authorImageMap[item.author] }} style={styles.featuredAuthorAvatar} />
                      ) : null}
                      <Text style={styles.shopGridBrand} numberOfLines={1}>{item.author}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Text style={[styles.shopGridBrand, { color: item.difficulty === '쉬움' ? '#1BAE74' : item.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{item.difficulty}</Text>
                      <Text style={{ fontSize: 11, color: '#DCDCDC' }}>·</Text>
                      <Ionicons name="time-outline" size={11} color="#BBB" />
                      <Text style={styles.shopGridBrand}>{item.time}분</Text>
                      <Text style={{ fontSize: 11, color: '#DCDCDC' }}>·</Text>
                      <Text style={styles.shopGridBrand}>{item.calories}kcal</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              removeClippedSubviews={Platform.OS === 'android'}
              ListHeaderComponent={
                <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                  {RECIPE_CATS.map(c => (
                    <TouchableOpacity key={c} style={[styles.filterChip, recipeFilter === c && styles.filterChipActive]} onPress={() => setRecipeFilter(c)}>
                      <Text style={[styles.filterChipText, recipeFilter === c && styles.filterChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                </>
              }
              ListEmptyComponent={dataLoading ? <View style={styles.empty}><ActivityIndicator size="small" color="#1A1A1A" /></View> : <View style={styles.empty}><Text style={styles.emptyText}>레시피 결과가 없습니다</Text></View>}
              keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" />
          )}

          {tab === '쇼핑' && (
            <FlatList data={shopResults} keyExtractor={(item) => item.id}
              ref={resultListRef}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
              scrollEventThrottle={100}
              columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: Math.max(insets.bottom, 48) + 40 }}
              ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              renderItem={renderShopCard}
              removeClippedSubviews={Platform.OS === 'android'}
              ListHeaderComponent={
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                  {SHOP_CATS.map(c => (
                    <TouchableOpacity key={c} style={[styles.filterChip, shopFilter === c && styles.filterChipActive]} onPress={() => setShopFilter(c)}>
                      <Text style={[styles.filterChipText, shopFilter === c && styles.filterChipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              }
              ListEmptyComponent={dataLoading ? <View style={styles.empty}><ActivityIndicator size="small" color="#1A1A1A" /></View> : <View style={styles.empty}><Text style={styles.emptyText}>쇼핑 결과가 없습니다</Text></View>}
              keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" />
          )}

          {tab === '셰프' && (
            <FlatList data={chefResults} keyExtractor={(item) => item.uid}
              ref={resultListRef as any}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
              scrollEventThrottle={100}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 48) + 40 }}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              renderItem={renderChefCard}
              removeClippedSubviews={Platform.OS === 'android'}
              ListEmptyComponent={dataLoading ? <View style={styles.empty}><ActivityIndicator size="small" color="#1A1A1A" /></View> : <View style={styles.empty}><Text style={styles.emptyText}>셰프 결과가 없습니다</Text></View>}
              keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" />
          )}
          {showScrollTop && (
            <TouchableOpacity
              style={styles.scrollTopBtn}
              activeOpacity={0.8}
              onPress={() => resultListRef.current?.scrollToOffset({ offset: 0, animated: true })}
            >
              <Ionicons name="arrow-up" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
  },
  searchBarGradient: {
    flex: 1, height: 40, borderRadius: 20, padding: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 19,
    paddingHorizontal: 14, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', padding: 0, height: 38 },
  placeholderOverlay: { position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' },
  placeholderRotating: { fontSize: 14, color: '#6B6B6B' },

  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  sectionCount: { fontSize: 13, color: '#9E9E9E', fontWeight: '500' },
  sectionAction: { fontSize: 12, color: '#9E9E9E' },
  sectionMore: { fontSize: 13, color: '#666' },

  // 최근 검색어 (가로 스크롤)
  horizontalChipRow: { gap: 8, paddingHorizontal: 20 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 8, paddingVertical: 7,
    borderRadius: 18, backgroundColor: '#F5F5F5',
  },
  chipText: { fontSize: 13, color: '#1A1A1A', fontWeight: '500' },

  recommendChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    borderWidth: 1, borderColor: '#E5E5E5', backgroundColor: '#FFFFFF',
  },
  recommendChipText: { fontSize: 13, color: '#1A1A1A', fontWeight: '500' },

  // 카테고리 4열 그리드
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryCell: { width: '25%', alignItems: 'center', paddingVertical: 10 },
  categoryIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  shopCategoryIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#F5F2ED',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  categoryImage: { width: 58, height: 58, marginBottom: 4 },
  categoryEmojiWrap: {
    width: 58, height: 58, marginBottom: 4,
    justifyContent: 'center', alignItems: 'center',
  },
  categoryEmoji: { fontSize: 36 },
  categoryLabel: { fontSize: 12, color: '#1A1A1A', fontWeight: '500' },

  // 인기 검색어 (2열)
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  trendingItem: {
    width: '50%', flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingRight: 16, gap: 8,
  },
  trendingRank: { width: 20, fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  trendingRankTop: { color: '#FF3B30' },
  trendingKeyword: { flex: 1, fontSize: 14, color: '#1A1A1A' },
  categoryBadge: {
    backgroundColor: '#F0F4FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  categoryBadgeText: { fontSize: 10, color: '#3B82F6', fontWeight: '600' },
  newBadge: {
    backgroundColor: '#FF3B30', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },
  newBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

  // 추천 기획전 - 추천 레시피
  featuredCard: { width: 140 },
  featuredImage: {
    width: 140, height: 140, borderRadius: 8, marginBottom: 8, backgroundColor: '#F5F5F5',
  },
  featuredTitle: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', marginBottom: 2 },
  featuredMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, marginTop: 2 },
  featuredMeta: { fontSize: 11, color: '#888' },
  featuredDot: { fontSize: 11, color: '#DCDCDC', marginHorizontal: 1 },
  featuredAuthorAvatar: { width: 14, height: 14, borderRadius: 7 },
  featuredAuthorFallback: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#E0E0E0', justifyContent: 'center' as const, alignItems: 'center' as const },

  // 인기 셰프
  chefCardSm: { width: 80, alignItems: 'center' },
  chefCardSmAvatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  chefCardSmName: { fontSize: 12, fontWeight: '600', color: '#1A1A1A', marginBottom: 2 },
  chefCardSmMeta: { fontSize: 10, color: '#888' },

  // 결과 탭
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingHorizontal: 8,
  },
  tabItem: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: '#1A1A1A' },
  tabText: { fontSize: 14, color: '#9E9E9E', fontWeight: '500' },
  tabTextActive: { color: '#1A1A1A', fontWeight: '700' },

  // 카드
  recipeCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: '#F0F0F0', marginHorizontal: 16, marginBottom: 10,
  },
  recipeImage: { width: 100, height: 100 },
  recipeInfo: { flex: 1, padding: 12, justifyContent: 'center', gap: 4 },
  recipeTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  recipeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  recipeMetaText: { fontSize: 12, color: '#888' },
  dot: { fontSize: 12, color: '#BDBDBD', marginHorizontal: 2 },

  shopGridCard: {
    flex: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#FFFFFF',
  },
  shopGridImage: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 8 },
  shopGridBody: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 10, gap: 2 },
  shopGridBrand: { fontSize: 11, color: '#888' },
  shopGridName: { fontSize: 15, fontWeight: '500', color: '#1A1A1A', lineHeight: 20 },
  shopGridPrice: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginTop: 2 },
  shopCard: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0F0F0',
    marginHorizontal: 16, marginBottom: 10,
  },
  shopImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#F5F5F5' },
  shopBrand: { fontSize: 12, color: '#9E9E9E', marginBottom: 2 },
  shopName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  shopPrice: { fontSize: 14, fontWeight: '800', color: '#1A1A1A', marginTop: 4 },

  chefCard: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginBottom: 10,
  },
  chefAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F5F5F5' },
  chefAvatarWrap: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  chefAvatarInner: { width: 48, height: 48 },
  chefName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  chefMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  chefProfileBtn: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chefProfileBtnText: { fontSize: 12, fontWeight: '600', color: '#1A1A1A' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, color: '#9E9E9E' },

  emptyResults: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#888' },
  emptySectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 10, textAlign: 'center' },
  filterChipRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  tagFilterChipRow: { gap: 8, paddingHorizontal: 16, paddingTop: 0, paddingBottom: 10 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    borderWidth: 1, borderColor: '#E0E0E0', backgroundColor: '#FFFFFF',
  },
  filterChipActive: { borderColor: '#1A1A1A', backgroundColor: '#1A1A1A' },
  filterChipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  tagFilterChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#F5F5F5', minHeight: 32, justifyContent: 'center',
  },
  tagFilterChipActive: { backgroundColor: '#1A1A1A' },
  tagFilterChipText: { fontSize: 12, lineHeight: 18, color: '#1A1A1A', fontWeight: '600' },
  tagFilterChipTextActive: { color: '#FFFFFF' },
  unifiedGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, paddingHorizontal: 16, justifyContent: 'space-between' as const, rowGap: 14 },
  unifiedGridItem: { width: '48%' as any },
  scrollTopBtn: {
    position: 'absolute' as const,
    bottom: 24,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
