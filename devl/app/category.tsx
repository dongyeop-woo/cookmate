import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { fetchRecipes, fetchCategories } from '../services/api';
import type { Recipe, Category } from '../constants/recipes';

const { width } = Dimensions.get('window');
const PIXEL_RATIO = Math.ceil(Dimensions.get('window').scale);

const hiResImage = (uri: string, w = 800) => {
  if (uri && uri.includes('unsplash.com')) {
    return uri.replace(/[?&]w=\d+/, `?w=${w * PIXEL_RATIO}`);
  }
  return uri;
};

const categoryIcons: Record<string, any> = {
  '아침': require('../assets/icons/breakfast.png'),
  '점심': require('../assets/icons/2.png'),
  '저녁': require('../assets/icons/3.png'),
  '디저트': require('../assets/icons/4.png'),
  '간식': require('../assets/icons/5.png'),
  '음료': require('../assets/icons/6.png'),
};

type SortType = '추천순' | '평점순' | '시간순';
type FilterType = 'best' | 'recommended' | 'quick' | 'snack' | 'weekly' | undefined;

const filterTitles: Record<string, string> = {
  best: '🏆 베스트 레시피',
  recommended: '추천 레시피',
  quick: '⚡ 초스피드 요리',
  snack: '🍰 인기 간식',
  weekly: '이번 주 레시피',
};

export default function CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; filter?: string }>();
  const filter = params.filter as FilterType;
  const [selectedCategory, setSelectedCategory] = useState(params.category || '전체');
  const [sortType, setSortType] = useState<SortType>('추천순');
  const [showSortMenu, setShowSortMenu] = useState(false);
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

  const filteredRecipes = useMemo(() => {
    let list: Recipe[];

    if (filter) {
      switch (filter) {
        case 'best':
          list = [...recipes].sort((a, b) => b.rating - a.rating);
          break;
        case 'recommended':
          list = [...recipes].sort((a, b) => b.rating - a.rating);
          break;
        case 'quick':
          list = recipes.filter(r => r.time <= 15).sort((a, b) => a.time - b.time);
          break;
        case 'snack':
          list = recipes.filter(r => r.category === '간식' || r.category === '디저트');
          break;
        case 'weekly':
          list = recipes.filter(r => r.category === '저녁');
          break;
        default:
          list = [...recipes];
      }
    } else {
      list = selectedCategory === '전체'
        ? [...recipes]
        : recipes.filter(r => r.category === selectedCategory);
    }

    if (!filter || (filter !== 'best' && filter !== 'recommended' && filter !== 'quick')) {
      switch (sortType) {
        case '평점순':
          list.sort((a, b) => b.rating - a.rating);
          break;
        case '시간순':
          list.sort((a, b) => a.time - b.time);
          break;
        default:
          list.sort((a, b) => b.rating - a.rating);
          break;
      }
    }
    return list;
  }, [selectedCategory, sortType, filter, recipes]);

  const categoryTabs = [{ id: '0', name: '전체' }, ...categories];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {filter ? filterTitles[filter] : selectedCategory === '전체' ? '전체 레시피' : selectedCategory}
        </Text>
        <TouchableOpacity onPress={() => router.push('/search')} style={styles.searchButton}>
          <Text style={styles.searchIcon}>⌕</Text>
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      {!filter && (
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {categoryTabs.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.tab, selectedCategory === cat.name && styles.tabActive]}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <Text style={[styles.tabText, selectedCategory === cat.name && styles.tabTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      )}

      {/* Category Icons (sub-categories) */}
      {!filter && selectedCategory === '전체' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconScrollContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={styles.iconItem}
              onPress={() => setSelectedCategory(cat.name)}
            >
              <View style={styles.iconCircle}>
                {categoryIcons[cat.name] ? (
                  <Image source={categoryIcons[cat.name]} style={styles.iconImage} />
                ) : (
                  <Text style={styles.iconEmoji}>{cat.icon}</Text>
                )}
              </View>
              <Text style={styles.iconLabel}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Sort & Filter */}
      <View style={styles.filterRow}>
        <Text style={styles.resultCount}>{filteredRecipes.length}개의 레시피</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => setShowSortMenu(!showSortMenu)}
          >
            <Text style={styles.sortButtonText}>{sortType} ▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Dropdown */}
      {showSortMenu && (
        <View style={styles.sortMenu}>
          {(['추천순', '평점순', '시간순'] as SortType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.sortMenuItem, sortType === type && styles.sortMenuItemActive]}
              onPress={() => { setSortType(type); setShowSortMenu(false); }}
            >
              <Text style={[styles.sortMenuText, sortType === type && styles.sortMenuTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recipe List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      >
        {filteredRecipes.map((recipe) => (
          <TouchableOpacity
            key={recipe.id}
            style={styles.recipeCard}
            onPress={() => router.push(`/recipe/${recipe.id}`)}
            activeOpacity={0.85}
          >
            <Image source={{ uri: hiResImage(recipe.image) }} style={styles.recipeImage} />
            <View style={styles.recipeInfo}>
              <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
              <Text style={styles.recipeAuthor}>By {recipe.author}</Text>
              <View style={styles.recipeMeta}>
                <Text style={styles.recipeRating}>♥ {recipe.likes ?? 0}</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeTime}>☆ {recipe.bookmarks ?? 0}</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeTime}>◷ {recipe.time}분</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeDifficulty}>{recipe.difficulty}</Text>
              </View>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{recipe.category}</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{recipe.calories}kcal</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    fontSize: 26,
    color: '#1A1A1A',
  },

  // Category Tabs
  tabsWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0B9A61',
  },
  tabText: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },

  // Category Icons
  iconScrollContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconItem: {
    alignItems: 'center',
    width: 72,
    marginRight: 12,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  iconImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    resizeMode: 'cover',
  },
  iconEmoji: {
    fontSize: 26,
  },
  iconLabel: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
    marginTop: 2,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultCount: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  sortButtonText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },

  // Sort Menu
  sortMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 170 : 150,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    minWidth: 120,
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
    color: '#0B9A61',
    fontWeight: '600',
  },

  // Recipe Cards
  listContainer: {
    paddingHorizontal: 20,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recipeImage: {
    width: 120,
    height: 120,
  },
  recipeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  recipeAuthor: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 6,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recipeRating: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  recipeDot: {
    fontSize: 13,
    color: '#BDBDBD',
    marginHorizontal: 6,
  },
  recipeTime: {
    fontSize: 13,
    color: '#666',
  },
  recipeDifficulty: {
    fontSize: 13,
    color: '#666',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
});
