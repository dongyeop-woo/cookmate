import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

type SortType = '추천순' | '평점순' | '시간순';
type QuickFilter = '전체' | '초스피드' | '쉬운요리' | '다이어트';

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string; query?: string }>();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [sortType, setSortType] = useState<SortType>('추천순');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('전체');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [r, c] = await Promise.all([fetchRecipes(), fetchCategories()]);
        setRecipes(r);
        setCategories(c);
      } catch (e) {
        console.warn('API 로드 실패:', e);
      }
    })();
  }, []);

  useEffect(() => {
    if (params.category) {
      setSelectedCategory(params.category);
    }
    if (params.query) {
      setSearch(params.query);
    }
  }, [params.category, params.query]);

  const filteredRecipes = useMemo(() => {
    let list = recipes.filter(r => {
      const matchesSearch = search.length === 0 ||
        r.title.includes(search) ||
        r.author.includes(search) ||
        r.ingredients.some(ing => ing.name.includes(search));
      const matchesCategory = selectedCategory === '전체' || r.category === selectedCategory;

      let matchesQuickFilter = true;
      if (quickFilter === '초스피드') matchesQuickFilter = r.time <= 15;
      else if (quickFilter === '쉬운요리') matchesQuickFilter = r.difficulty === '쉬움';
      else if (quickFilter === '다이어트') matchesQuickFilter = r.calories <= 300;

      return matchesSearch && matchesCategory && matchesQuickFilter;
    });

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
    return list;
  }, [search, selectedCategory, sortType, quickFilter, recipes]);

  const categoryTabs = [{ id: '0', name: '전체' }, ...categories];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="레시피, 재료, 셰프 검색"
          placeholderTextColor="#9E9E9E"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs */}
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

      {/* Sort & Filter */}
      <View style={styles.filterRow}>
        <Text style={styles.resultCount}>{filteredRecipes.length}개의 레시피</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
          >
            <Text style={[styles.sortButtonText, quickFilter !== '전체' && styles.activeFilterText]}>
              {quickFilter === '전체' ? '필터' : quickFilter === '초스피드' ? '⚡ 15분 이하' : quickFilter === '쉬운요리' ? '👌 쉬운요리' : '🥗 300kcal↓'} ▾
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
          >
            <Text style={styles.sortButtonText}>{sortType} ▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Dropdown */}
      {showFilterMenu && (
        <View style={styles.sortMenu}>
          {(['전체', '초스피드', '쉬운요리', '다이어트'] as QuickFilter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.sortMenuItem, quickFilter === f && styles.sortMenuItemActive]}
              onPress={() => { setQuickFilter(f); setShowFilterMenu(false); }}
            >
              <Text style={[styles.sortMenuText, quickFilter === f && styles.sortMenuTextActive]}>
                {f === '초스피드' ? '⚡ 15분 이하' : f === '쉬운요리' ? '👌 쉬운요리' : f === '다이어트' ? '🥗 300kcal↓' : f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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

      {/* Results */}
      <FlatList
        data={filteredRecipes}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.recipeCard}
            onPress={() => router.push(`/recipe/${item.id}`)}
            activeOpacity={0.85}
          >
            <Image source={{ uri: item.image }} style={styles.recipeImage} />
            <View style={styles.recipeInfo}>
              <Text style={styles.recipeTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.recipeAuthor}>By {item.author}</Text>
              <View style={styles.recipeMeta}>
                <Text style={styles.recipeTime}>◷ {item.time}분</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeDifficulty}>{item.difficulty}</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeLikes}>♥ {item.likes || 0}</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeBookmarks}>☆ {item.bookmarks || 0}</Text>
                <Text style={styles.recipeDot}>·</Text>
                <Text style={styles.recipeComments}>✎ {Array.isArray(item.comments) ? item.comments.length : (item.comments || 0)}</Text>
              </View>
              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.category}</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.calories}kcal</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>⌕</Text>
            <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 12 : 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    fontSize: 26,
    marginRight: 8,
    color: '#9E9E9E',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    height: 48,
  },
  clearText: {
    fontSize: 16,
    color: '#9E9E9E',
    padding: 4,
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
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  resultCount: {
    fontSize: 13,
    color: '#9E9E9E',
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  activeFilterText: {
    color: '#0B9A61',
  },
  sortButtonText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },

  // Sort Menu
  sortMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 220 : 200,
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
    paddingBottom: 20,
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
  recipeLikes: {
    fontSize: 13,
    color: '#999',
  },
  recipeBookmarks: {
    fontSize: 13,
    color: '#999',
  },
  recipeComments: {
    fontSize: 13,
    color: '#999',
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

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    color: '#BDBDBD',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#9E9E9E',
  },
});
