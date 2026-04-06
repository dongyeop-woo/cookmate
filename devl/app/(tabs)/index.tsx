import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  FlatList,
  Dimensions,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { fetchRecipes, fetchCategories } from '../../services/api';
import type { Recipe, Category } from '../../constants/recipes';

const categoryIcons: Record<string, any> = {
  '아침': require('../../assets/icons/breakfast.png'),
  '점심': require('../../assets/icons/2.png'),
  '저녁': require('../../assets/icons/3.png'),
  '디저트': require('../../assets/icons/4.png'),
  '간식': require('../../assets/icons/5.png'),
  '음료': require('../../assets/icons/6.png'),
};

const { width } = Dimensions.get('window');
const PIXEL_RATIO = Math.ceil(Dimensions.get('window').scale);

const hiResImage = (uri: string, w = 800) => {
  if (uri && uri.includes('unsplash.com')) {
    return uri.replace(/[?&]w=\d+/, `?w=${w * PIXEL_RATIO}`);
  }
  return uri;
};

const placeholderTexts = [
  '계란말이',
  '참치마요 주먹밥',
  '김치볶음밥',
  '된장찌개',
  '떡볶이',
  '불고기',
  '잡채',
  '비빔밥',
  '순두부찌개',
  '닭갈비',
  '호떡',
  '약과',
  '미숫가루',
  '감자전',
  '궁중떡볶이',
  '오므라이스',
];

export default function HomeScreen() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('아침');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([fetchRecipes(), fetchCategories()]);
        setRecipes(r);
        setCategories(c);
      } catch (e) {
        console.warn('API 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const r = await fetchRecipes();
          setRecipes(r);
        } catch (e) {
          console.warn('API 로드 실패:', e);
        }
      })();
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -24,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setPlaceholderIndex(prev => (prev + 1) % placeholderTexts.length);
        slideAnim.setValue(24);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // 시드 기반 셔플 (날짜/주 단위로 고정된 랜덤)
  const seededShuffle = (arr: Recipe[], seed: number) => {
    const copy = [...arr];
    let s = seed;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const now = new Date();
  const daySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const weekSeed = now.getFullYear() * 100 + Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

  const recommendedRecipes = seededShuffle(recipes, daySeed).slice(0, 6);
  const quickRecipes = [...recipes].filter(r => r.time <= 15).sort((a, b) => a.time - b.time).slice(0, 6);
  const weeklyRecipes = seededShuffle(recipes, weekSeed).slice(0, 6);
  const bestRecipes = [...recipes].sort((a, b) => ((b.likes || 0) + (b.bookmarks || 0)) - ((a.likes || 0) + (a.bookmarks || 0))).slice(0, 10);
  const snackRecipes = recipes.filter(r => r.category === '간식' || r.category === '디저트').slice(0, 6);

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const catCount = categories.length || 6;
  const categoryIconSize = Math.min(72, (screenWidth - 32) / catCount - 8);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>안녕하세요 👋</Text>
            <Text style={styles.title}>오늘은 무엇을{'\n'}요리할까요?</Text>
          </View>
          <View style={styles.avatar}>
            <Image source={require('../../assets/icon.png')} style={styles.avatarImage} />
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>⌕</Text>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (search.trim().length > 0) {
                  router.push({ pathname: '/(tabs)/search', params: { query: search.trim() } });
                  setSearch('');
                }
              }}
            />
            {search.length === 0 && (
              <Animated.Text
                style={[
                  styles.animatedPlaceholder,
                  {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                  },
                ]}
                pointerEvents="none"
              >
                {placeholderTexts[placeholderIndex]}
              </Animated.Text>
            )}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>카테고리</Text>
          <TouchableOpacity onPress={() => router.push('/category')}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.categoriesContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                onPress={() => router.push({ pathname: '/(tabs)/search', params: { category: cat.name } })}
              >
                <View style={[styles.categoryIcon, { width: categoryIconSize, height: categoryIconSize, borderRadius: categoryIconSize * 0.3 }]}>
                  {categoryIcons[cat.name] ? (
                    <Image source={categoryIcons[cat.name]} style={{ width: categoryIconSize, height: categoryIconSize, borderRadius: categoryIconSize * 0.3, resizeMode: 'cover' } as any} />
                  ) : (
                    <Text style={[styles.categoryEmoji, { fontSize: categoryIconSize * 0.4 }]}>{cat.icon}</Text>
                  )}
                </View>
                <Text style={styles.categoryText}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        {/* 베스트 레시피 TOP 10 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🏆 베스트 레시피</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/category', params: { filter: 'best' } })}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bestListHorizontal}>
          {bestRecipes.map((recipe, idx) => {
            return (
              <TouchableOpacity
                key={recipe.id}
                style={styles.bestCard}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                activeOpacity={0.9}
              >
                <Image source={{ uri: hiResImage(recipe.image) }} style={styles.bestImage} />
                {/* Rank Badge */}
                {idx < 3 ? (
                  <View style={[styles.bestRankTop, { backgroundColor: ['#FF6B35','#0B9A61','#3B82F6'][idx] }]}>
                    <Text style={styles.bestRankTopText}>{['TOP1','TOP2','TOP3'][idx]}</Text>
                  </View>
                ) : (
                  <View style={styles.bestRankNormal}>
                    <Text style={styles.bestRankNormalText}>{idx + 1}</Text>
                  </View>
                )}
                {/* Bottom Overlay */}
                <View style={styles.bestOverlay}>
                  <Text style={styles.bestCategory}>{recipe.category}</Text>
                  <Text style={styles.bestTitle} numberOfLines={1}>{recipe.title}</Text>
                  <View style={styles.bestMeta}>
                    <Text style={styles.bestRating}>♥ {recipe.likes ?? 0}</Text>
                    <Text style={styles.bestTime}>☆ {recipe.bookmarks ?? 0}</Text>
                    <Text style={styles.bestTime}>✎ {Array.isArray(recipe.comments) ? recipe.comments.length : (recipe.comments ?? 0)}</Text>
                    <Text style={styles.bestTime}>◷ {recipe.time}분</Text>
                    <Text style={styles.bestDifficulty}>{recipe.difficulty}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 추천 레시피 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>추천 레시피</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/category', params: { filter: 'recommended' } })}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal}>
          {recommendedRecipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            >
              <Image source={{ uri: hiResImage(recipe.image) }} style={styles.recipeImage} />
              <Text style={styles.recipeName} numberOfLines={1}>{recipe.title}</Text>
              <Text style={styles.recipeAuthor}>By {recipe.author}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 초스피드 요리 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>⚡ 초스피드 요리</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/category', params: { filter: 'quick' } })}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal}>
          {quickRecipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            >
              <Image source={{ uri: hiResImage(recipe.image) }} style={styles.recipeImage} />
              <Text style={styles.recipeName} numberOfLines={1}>{recipe.title}</Text>
              <Text style={styles.recipeAuthor}>◷ {recipe.time}분 · {recipe.difficulty}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 인기 간식 & 디저트 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🍰 인기 간식</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/category', params: { filter: 'snack' } })}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal}>
          {snackRecipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeCard}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            >
              <Image source={{ uri: hiResImage(recipe.image) }} style={styles.recipeImage} />
              <Text style={styles.recipeName} numberOfLines={1}>{recipe.title}</Text>
              <Text style={styles.recipeAuthor}>By {recipe.author}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 이번 주 저녁 레시피 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>이번 주 레시피</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/category', params: { filter: 'weekly' } })}>
            <Text style={styles.seeAll}>전체보기</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weeklyContainer}>
          {weeklyRecipes.map((recipe) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.weeklyCard}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
            >
              <Image source={{ uri: hiResImage(recipe.image) }} style={styles.weeklyImage} />
              <View style={styles.weeklyOverlay}>
                <Text style={styles.weeklyTitle} numberOfLines={1}>{recipe.title}</Text>
                <Text style={styles.weeklyInfo}>◷ {recipe.time}분 · ♥ {recipe.likes ?? 0} · ☆ {recipe.bookmarks ?? 0} · ✎ {recipe.comments ?? 0}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 24,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 14,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    lineHeight: 32,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    fontSize: 30,
    marginRight: 8,
    color: '#9E9E9E',
  },
  searchInputWrapper: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 15,
    color: '#1A1A1A',
    height: 48,
  },
  animatedPlaceholder: {
    position: 'absolute',
    fontSize: 15,
    color: '#9E9E9E',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  seeAll: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  categoryItem: {
    flex: 1,
    alignItems: 'center',
  },
  categoryItemActive: {},
  categoryIcon: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  categoryIconActive: {
    backgroundColor: '#0B9A61',
  },
  categoryEmoji: {
    fontSize: 30,
  },
  categoryText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#0B9A61',
    fontWeight: '700',
  },
  recipeListHorizontal: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  recipeCard: {
    width: 150,
    marginHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    resizeMode: 'cover',
    overflow: 'hidden',
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  recipeAuthor: {
    fontSize: 12,
    color: '#9E9E9E',
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 2,
  },
  // Best Recipes
  bestListHorizontal: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bestCard: {
    width: width * 0.48,
    height: 220,
    marginHorizontal: 6,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  bestImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    resizeMode: 'cover',
  },
  bestRankTop: {
    position: 'absolute',
    top: 0,
    left: 12,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  bestRankTopText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bestRankNormal: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestRankNormalText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bestOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bestCategory: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginBottom: 2,
  },
  bestTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  bestMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bestRating: {
    fontSize: 12,
    color: '#FF4D67',
    fontWeight: '700',
  },
  bestTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  bestDifficulty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  weeklyContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  weeklyCard: {
    width: width * 0.55,
    height: 180,
    marginHorizontal: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  weeklyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  weeklyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 14,
  },
  weeklyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  weeklyInfo: {
    fontSize: 13,
    color: '#E0E0E0',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0B9A61',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B9A61',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '300',
    marginTop: -2,
  },
});
