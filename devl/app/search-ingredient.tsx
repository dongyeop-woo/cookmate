import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRecipes, fetchTopUsers } from '../services/api';
import type { Recipe } from '../constants/recipes';
import { useAuth } from './_layout';

const FREQ_KEY = (uid: string) => `ingredient_freq_${uid}`;

const { width } = Dimensions.get('window');

const INGREDIENT_CATEGORIES = [
  { title: '기본 재료', items: [
    { name: '계란', icon: '🥚' }, { name: '밥', icon: '🍚' }, { name: '면', icon: '🍜' },
    { name: '두부', icon: '🧈' }, { name: '떡', icon: '🍡' }, { name: '빵', icon: '🍞' },
  ]},
  { title: '고기 · 해산물', items: [
    { name: '돼지고기', icon: '🥩' }, { name: '소고기', icon: '🥓' }, { name: '닭고기', icon: '🍗' },
    { name: '닭가슴살', icon: '🐔' }, { name: '참치', icon: '🐟' }, { name: '새우', icon: '🦐' },
    { name: '오징어', icon: '🦑' }, { name: '조개', icon: '🦪' }, { name: '연어', icon: '🍣' },
    { name: '햄', icon: '🥓' }, { name: '베이컨', icon: '🥓' }, { name: '소시지', icon: '🌭' },
  ]},
  { title: '채소', items: [
    { name: '양파', icon: '🧅' }, { name: '대파', icon: '🌿' }, { name: '마늘', icon: '🧄' },
    { name: '감자', icon: '🥔' }, { name: '당근', icon: '🥕' }, { name: '배추', icon: '🥬' },
    { name: '시금치', icon: '🥬' }, { name: '콩나물', icon: '🌱' }, { name: '버섯', icon: '🍄' },
    { name: '호박', icon: '🎃' }, { name: '고추', icon: '🌶️' }, { name: '브로콜리', icon: '🥦' },
    { name: '토마토', icon: '🍅' }, { name: '오이', icon: '🥒' }, { name: '피망', icon: '🫑' },
  ]},
  { title: '양념 · 소스', items: [
    { name: '고추장', icon: '🌶️' }, { name: '된장', icon: '🫘' }, { name: '간장', icon: '🫗' },
    { name: '참기름', icon: '🫒' }, { name: '식초', icon: '🧴' }, { name: '설탕', icon: '🍬' },
    { name: '소금', icon: '🧂' }, { name: '후추', icon: '⚫' }, { name: '카레', icon: '🍛' },
    { name: '케첩', icon: '🍅' }, { name: '마요네즈', icon: '🥄' }, { name: '굴소스', icon: '🦪' },
  ]},
  { title: '유제품 · 기타', items: [
    { name: '우유', icon: '🥛' }, { name: '치즈', icon: '🧀' }, { name: '버터', icon: '🧈' },
    { name: '크림', icon: '🍦' }, { name: '김치', icon: '🥬' }, { name: '김', icon: '🟢' },
    { name: '밀가루', icon: '🌾' }, { name: '전분', icon: '🌾' },
  ]},
];

export default function SearchIngredientScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const params = useLocalSearchParams<{ preset?: string; auto?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [input, setInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [authorImages, setAuthorImages] = useState<Record<string, string>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [freqCounts, setFreqCounts] = useState<Record<string, number>>({});
  const resultListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      try {
        const [r, users] = await Promise.all([fetchRecipes(), fetchTopUsers(30)]);
        setRecipes(r);
        const map: Record<string, string> = {};
        for (const u of users) {
          if (u.nickname && u.profileImage && u.profileImage.startsWith('http')) map[u.nickname] = u.profileImage;
        }
        setAuthorImages(map);
      } catch {}
    })();
  }, []);

  // 자주 쓰는 재료 카운트 로드
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FREQ_KEY(firebaseUser.uid));
        if (raw) setFreqCounts(JSON.parse(raw));
      } catch {}
    })();
  }, [firebaseUser?.uid]);

  // 냉장고에서 선택한 재료 프리셋 자동 적용 (?preset=양파,돼지고기&auto=1)
  useEffect(() => {
    const preset = params.preset;
    if (!preset || typeof preset !== 'string') return;
    const names = preset.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    if (names.length === 0) return;
    setIngredients(names);
    if (params.auto === '1') {
      // 레시피 데이터 로드 기다림 없이 결과 보기 전환
      setTimeout(() => setShowResults(true), 100);
    }
  }, [params.preset, params.auto]);

  // 재료 선택 시 카운트 증가 (자주 쓰는 재료 학습)
  const bumpFreq = async (name: string) => {
    if (!firebaseUser?.uid) return;
    const next = { ...freqCounts, [name]: (freqCounts[name] || 0) + 1 };
    setFreqCounts(next);
    try {
      await AsyncStorage.setItem(FREQ_KEY(firebaseUser.uid), JSON.stringify(next));
    } catch {}
  };

  // 상위 6개 자주 쓰는 재료
  const frequentIngredients = useMemo(() => {
    return Object.entries(freqCounts)
      .filter(([, count]) => count >= 2) // 2회 이상 쓴 재료만
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name]) => name);
  }, [freqCounts]);

  // AI 분석 중 애니메이션
  useEffect(() => {
    if (ingredients.length === 0) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    const t = setTimeout(() => anim.stop(), 1500);
    return () => { anim.stop(); clearTimeout(t); };
  }, [ingredients.length]);

  const addIngredient = (name: string) => {
    const t = name.trim();
    if (!t) return;
    if (ingredients.includes(t)) return;
    if (ingredients.length >= 10) return;
    setIngredients(prev => [...prev, t]);
    setInput('');
    bumpFreq(t);
  };

  const toggleIngredient = (name: string) => {
    if (ingredients.includes(name)) {
      setIngredients(prev => prev.filter(i => i !== name));
    } else {
      if (ingredients.length >= 10) return;
      setIngredients(prev => [...prev, name]);
      bumpFreq(name);
    }
  };

  const removeIngredient = (name: string) => {
    setIngredients(prev => {
      const next = prev.filter(i => i !== name);
      if (next.length === 0) setShowResults(false);
      return next;
    });
  };

  const [showResults, setShowResults] = useState(false);

  const results = useMemo(() => {
    if (!showResults || ingredients.length === 0) return [];
    return recipes
      .map(r => {
        const matched = ingredients.filter(ing =>
          r.ingredients.some(ri => ri.name.toLowerCase().includes(ing.toLowerCase()))
        );
        // 레시피에 필요하지만 유저가 선택 안 한 재료 = "부족한 재료"
        const missing = r.ingredients
          .filter(ri => !ingredients.some(ing => ri.name.toLowerCase().includes(ing.toLowerCase())))
          .map(ri => ri.name);
        return {
          recipe: r,
          matchCount: matched.length,
          matchedIngredients: matched,
          missingIngredients: missing,
          missingCount: missing.length,
        };
      })
      .filter(r => r.matchCount > 0)
      .sort((a, b) => {
        // 매칭 많은 순 → 부족한 재료 적은 순 → 좋아요 많은 순
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
        return (b.recipe.likes || 0) - (a.recipe.likes || 0);
      });
  }, [recipes, ingredients, showResults]);

  const perfectMatch = results.filter(r => r.matchCount === ingredients.length);
  const partialMatch = results.filter(r => r.matchCount < ingredients.length);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>재료 기반 레시피</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* 히어로 배너 제거됨 — ai-recipe-banner.jpg 에셋 삭제됨 */}

      {/* 입력 - 결과 화면에서는 숨김 */}
      {!showResults && (
      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color="#9E9E9E" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="재료명 입력 후 추가"
            placeholderTextColor="#BDBDBD"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => addIngredient(input)}
            returnKeyType="done"
          />
          {input.length > 0 && (
            <TouchableOpacity style={styles.addBtn} onPress={() => addIngredient(input)}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      )}

      {/* 선택된 재료 칩 - 재료 선택 화면에서만 표시 */}
      {ingredients.length > 0 && !showResults && (
        <View style={styles.selectedSection}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedLabel}>선택한 재료 <Text style={{ color: '#1A1A1A' }}>{ingredients.length}</Text></Text>
            <TouchableOpacity onPress={() => { setIngredients([]); setShowResults(false); }} hitSlop={8}>
              <Text style={styles.clearAll}>초기화</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {ingredients.map(ing => (
              <TouchableOpacity key={ing} style={styles.selectedChip} onPress={() => removeIngredient(ing)} activeOpacity={0.7}>
                <Text style={styles.selectedChipText}>{ing}</Text>
                <Ionicons name="close" size={11} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 결과 + 재료 목록 */}
      {showResults ? (
        <>
        <View style={styles.resultHeader}>
          <View style={styles.resultHeaderLeft}>
            <Text style={styles.resultTitle}>
              {results.length > 0 ? `레시피 ${results.length}개` : '검색 중...'}
            </Text>
            <Text style={styles.resultSub}>
              {perfectMatch.length > 0 ? `완벽 ${perfectMatch.length} · 부분 ${partialMatch.length}` : '선택한 재료 기반'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => { setIngredients([]); setShowResults(false); }} hitSlop={8}>
              <Text style={styles.clearAll}>초기화</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowResults(false)} hitSlop={8} style={styles.editBtn}>
              <Ionicons name="options-outline" size={15} color="#555" />
              <Text style={styles.editBtnText}>재료 수정</Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          key="results"
          ref={resultListRef}
          data={results}
          keyExtractor={(item) => item.recipe.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
          scrollEventThrottle={100}
          removeClippedSubviews={Platform.OS === 'android'}
          columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: Math.max(insets.bottom, 48) + 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/recipe/${item.recipe.id}`)}>
              <View>
                <Image source={{ uri: item.recipe.image }} style={styles.cardImage} contentFit="cover" />
                <View style={[styles.matchBadge, item.matchCount === ingredients.length && styles.matchBadgePerfect]}>
                  <Text style={styles.matchBadgeText}>
                    {item.matchCount === ingredients.length ? '완벽' : `${item.matchCount}/${ingredients.length}`}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.recipe.title}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="star" size={11} color="#FFB800" />
                  <Text style={styles.cardMetaText}>{((item.recipe as any).reviewAvgRating ?? 0).toFixed(1)}</Text>
                  <Text style={styles.cardDot}>·</Text>
                  <Ionicons name="heart" size={11} color="#FF6B6B" />
                  <Text style={styles.cardMetaText}>{item.recipe.likes || 0}</Text>
                  <Text style={styles.cardDot}>·</Text>
                  {authorImages[item.recipe.author] ? (
                    <Image source={{ uri: authorImages[item.recipe.author] }} style={{ width: 14, height: 14, borderRadius: 7 }} />
                  ) : null}
                  <Text style={styles.cardMetaText} numberOfLines={1}>{item.recipe.author}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Ionicons name="time-outline" size={11} color="#BBB" />
                  <Text style={styles.cardMetaText}>{item.recipe.time}분</Text>
                  <Text style={styles.cardDot}>·</Text>
                  <Text style={[styles.cardMetaText, { color: item.recipe.difficulty === '쉬움' ? '#1BAE74' : item.recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{item.recipe.difficulty}</Text>
                  <Text style={styles.cardDot}>·</Text>
                  <Text style={styles.cardMetaText}>{item.recipe.calories}kcal</Text>
                </View>
                <View style={styles.matchRow}>
                  {item.matchedIngredients.map(m => (
                    <View key={m} style={styles.matchTag}>
                      <Ionicons name="checkmark" size={9} color="#1A1A1A" />
                      <Text style={styles.matchTagText}>{m}</Text>
                    </View>
                  ))}
                </View>
                {item.missingCount > 0 && item.missingCount <= 5 && (
                  <Text style={styles.missingHint}>
                    <Text style={styles.missingHintBold}>{item.missingCount}개</Text>만 더 있으면 완성!
                  </Text>
                )}
                {item.missingCount > 5 && (
                  <Text style={styles.missingHint}>재료 {item.missingCount}개 필요</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="sad-outline" size={36} color="#BDBDBD" />
              </View>
              <Text style={styles.emptyTitle}>아쉽지만 결과가 없어요</Text>
              <Text style={styles.emptySub}>다른 재료를 추가하거나 변경해보세요</Text>
            </View>
          }
        />
        {showScrollTop && (
          <TouchableOpacity
            style={styles.scrollTopBtn}
            activeOpacity={0.8}
            onPress={() => resultListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Ionicons name="arrow-up" size={20} color="#1A1A1A" />
          </TouchableOpacity>
        )}
        </>
      ) : (
        <>
          <FlatList
            key="categories"
            data={INGREDIENT_CATEGORIES}
            keyExtractor={(item) => item.title}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 48) + 80 }}
            ListHeaderComponent={frequentIngredients.length > 0 ? (
              <View style={styles.suggestSection}>
                <View style={styles.freqTitleRow}>
                  <Ionicons name="sparkles" size={14} color="#1A1A1A" />
                  <Text style={[styles.suggestTitle, { marginBottom: 0 }]}>자주 쓰는 재료</Text>
                </View>
                <View style={styles.suggestGrid}>
                  {frequentIngredients.map(name => {
                    // 이모지를 전체 카테고리에서 찾아보기
                    const icon = INGREDIENT_CATEGORIES
                      .flatMap(c => c.items)
                      .find(i => i.name === name)?.icon || '🥄';
                    return (
                      <TouchableOpacity
                        key={`freq_${name}`}
                        style={[styles.suggestItem, ingredients.includes(name) && styles.suggestItemActive]}
                        onPress={() => toggleIngredient(name)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.suggestEmoji}>{icon}</Text>
                        <Text style={[styles.suggestName, ingredients.includes(name) && { color: '#1A1A1A', fontWeight: '700' }]}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}
            renderItem={({ item: cat }) => (
              <View style={styles.suggestSection}>
                <Text style={styles.suggestTitle}>{cat.title}</Text>
                <View style={styles.suggestGrid}>
                  {cat.items.map(ing => (
                    <TouchableOpacity
                      key={ing.name}
                      style={[styles.suggestItem, ingredients.includes(ing.name) && styles.suggestItemActive]}
                      onPress={() => toggleIngredient(ing.name)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestEmoji}>{ing.icon}</Text>
                      <Text style={[styles.suggestName, ingredients.includes(ing.name) && { color: '#1A1A1A', fontWeight: '700' }]}>{ing.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          />
          {ingredients.length > 0 && (
            <View style={styles.searchBtnWrap}>
              <TouchableOpacity style={styles.searchBtn} activeOpacity={0.8} onPress={() => setShowResults(true)}>
                <Ionicons name="search" size={18} color="#FFFFFF" />
                <Text style={styles.searchBtnText}>재료 {ingredients.length}개로 레시피 찾기</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  // 히어로
  hero: {
    marginHorizontal: 16, marginTop: 8, borderRadius: 16, overflow: 'hidden',
  },
  heroBanner: {
    width: '100%', aspectRatio: 1083 / 264, borderRadius: 16,
  },

  // 입력
  inputRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 14, paddingLeft: 14, paddingRight: 8, height: 48, gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: '#1A1A1A', padding: 0 },
  addBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1A1A1A',
    justifyContent: 'center', alignItems: 'center',
  },

  // 선택된 재료
  selectedSection: { paddingHorizontal: 16, paddingBottom: 14 },
  selectedHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  selectedLabel: { fontSize: 14, fontWeight: '600', color: '#888' },
  clearAll: { fontSize: 13, color: '#999' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F5F5', paddingLeft: 14, paddingRight: 10, paddingVertical: 8, borderRadius: 20,
  },
  selectedChipText: { fontSize: 13, fontWeight: '500', color: '#1A1A1A' },

  // 자주 쓰는 재료
  suggestSection: { paddingHorizontal: 16, paddingTop: 20 },
  suggestTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 14 },
  freqTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  suggestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  suggestItem: {
    width: (width - 32 - 40) / 5, alignItems: 'center', paddingVertical: 10,
  },
  suggestEmoji: { fontSize: 28, marginBottom: 4 },
  suggestName: { fontSize: 12, color: '#1A1A1A', fontWeight: '500' },
  suggestItemActive: { backgroundColor: '#F0F0F0', borderRadius: 12 },

  // 결과 헤더
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14,
  },
  resultHeaderLeft: { gap: 2 },
  resultTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  resultSub: { fontSize: 12, color: '#999' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#DCDCDC', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { fontSize: 12, fontWeight: '600', color: '#555' },

  // 카드
  card: { flex: 1, maxWidth: '48%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  cardImage: { width: '100%', aspectRatio: 1, backgroundColor: '#F5F5F5', borderRadius: 12 },
  matchBadge: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  matchBadgePerfect: { backgroundColor: '#1A1A1A' },
  matchBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  cardBody: { paddingTop: 8, paddingBottom: 10, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '500', color: '#1A1A1A', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardMetaText: { fontSize: 11, color: '#888' },
  cardDot: { fontSize: 11, color: '#DCDCDC' },
  matchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  matchTag: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: '#F0F0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  matchTagText: { fontSize: 10, fontWeight: '600', color: '#555' },
  missingHint: { fontSize: 11, color: '#999', marginTop: 6 },
  missingHintBold: { color: '#1A1A1A', fontWeight: '800' },

  // 빈 상태
  searchBtnWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: Platform.OS === 'android' ? 48 : 32, paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1BAE74', borderRadius: 14,
    paddingVertical: 16,
  },
  searchBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#888' },
  scrollTopBtn: {
    position: 'absolute', bottom: 90, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E0E0E0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
});
