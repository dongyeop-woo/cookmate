import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  searchHaccpProducts,
  searchFoodAll,
  guessIconFromProduct,
  type HaccpProduct,
} from '../services/haccp';
import { trackFailedSearch } from '../services/api';

const TEXT = '#1A1A1A';
const SUBTEXT = '#8E8E93';
const BORDER = '#ECECEC';
const SURFACE = '#F5F5F7';

export const RECIPE_INGREDIENT_PICKED = 'recipe:ingredientPicked';

const SEED_KEYWORDS = [
  '우유', '치즈', '요거트', '버터',
  '돼지고기', '소고기', '닭고기', '참치', '연어', '햄', '소시지',
  '김치', '두부', '계란', '떡', '빵', '면',
  '감자', '양파', '당근', '고추', '토마토',
  '고추장', '된장', '간장', '참기름', '식초',
  '과자', '초콜릿', '라면', '만두', '아이스크림',
];
const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

type PickedProduct = {
  name: string;
  manufacture?: string;
  capacity?: string;
  imgurl1?: string;
  prdkind?: string;
};

export default function RecipeIngredientAddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ index?: string }>();
  const targetIndex = params.index !== undefined ? Number(params.index) : -1;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HaccpProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [baseProducts, setBaseProducts] = useState<HaccpProduct[]>([]);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseSeed] = useState(() => pickRandom(SEED_KEYWORDS));

  const [picked, setPicked] = useState<PickedProduct | null>(null);
  const [amount, setAmount] = useState('');
  const [grams, setGrams] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await searchHaccpProducts(baseSeed, 1, 30);
      if (!cancelled) {
        setBaseProducts(shuffle(r.items));
        setBaseLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [baseSeed]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const r = await searchFoodAll(q, 1, 30);
      if (r.error) setError('검색 중 오류가 발생했어요');
      setResults(r.items);
      setLoading(false);
      if (!r.error && r.items.length === 0) {
        trackFailedSearch(q, 'ingredient');
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const pickProduct = (p: HaccpProduct) => {
    setPicked({
      name: p.prdlstNm,
      manufacture: p.manufacture,
      capacity: p.capacity,
      imgurl1: p.imgurl1,
      prdkind: p.prdkind,
    });
    setAmount('');
    setGrams('');
  };

  const pickManual = () => {
    const clean = query.trim();
    if (!clean) return;
    setPicked({ name: clean });
    setAmount('');
    setGrams('');
  };

  const reselect = () => {
    setPicked(null);
  };

  const handleConfirm = () => {
    if (!picked) return;
    const a = amount.trim();
    const g = grams.trim();
    let amountLabel = a;
    if (g) amountLabel = a ? `${a} (${g}g)` : `${g}g`;
    DeviceEventEmitter.emit(RECIPE_INGREDIENT_PICKED, {
      index: targetIndex,
      name: picked.name,
      amount: amountLabel,
    });
    router.back();
  };

  const isSearching = query.trim().length >= 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>{picked ? '재료 양 입력' : '재료 검색'}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      {picked ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, paddingHorizontal: 20 }}>
            <View style={styles.pickedCard}>
              {picked.imgurl1 ? (
                <Image source={{ uri: picked.imgurl1 }} style={styles.pickedThumb} contentFit="cover" />
              ) : (
                <View style={[styles.pickedThumb, styles.pickedThumbFallback]}>
                  <Text style={{ fontSize: 28 }}>
                    {guessIconFromProduct({ prdlstNm: picked.name, prdkind: picked.prdkind })}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.pickedName} numberOfLines={2}>{picked.name}</Text>
                {(picked.manufacture || picked.capacity) ? (
                  <Text style={styles.pickedMeta} numberOfLines={1}>
                    {[picked.manufacture, picked.capacity].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={reselect} style={styles.reselectBtn}>
                <Text style={styles.reselectText}>다시 선택</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>양</Text>
            <TextInput
              style={styles.field}
              value={amount}
              onChangeText={setAmount}
              placeholder="예: 2개, 한 큰술, 반 컵"
              placeholderTextColor="#BDBDBD"
              maxLength={30}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>그램수 (선택)</Text>
            <View style={styles.gramsRow}>
              <TextInput
                style={[styles.field, { flex: 1 }]}
                value={grams}
                onChangeText={(v) => setGrams(v.replace(/[^0-9]/g, ''))}
                placeholder="예: 100"
                placeholderTextColor="#BDBDBD"
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
              />
              <Text style={styles.gramsUnit}>g</Text>
            </View>
            <Text style={styles.hint}>양은 필수, 그램수는 있으면 자동으로 병기됩니다.</Text>
          </View>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[styles.confirmBtn, !amount.trim() && !grams.trim() && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!amount.trim() && !grams.trim()}
            >
              <Text style={styles.confirmText}>
                {targetIndex >= 0 ? '재료 수정' : '재료 추가'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={SUBTEXT} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="재료나 제품명을 검색해보세요"
                placeholderTextColor="#BDBDBD"
                style={styles.searchInput}
                maxLength={30}
                returnKeyType="search"
                autoCorrect={false}
                autoFocus
              />
              {loading ? (
                <ActivityIndicator size="small" color={SUBTEXT} />
              ) : query.length > 0 ? (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#C4C4C4" />
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.helperText}>동일 제품이 없다면, 비슷한 상품으로 골라주세요.</Text>
          </View>

          {isSearching ? (
            error ? (
              <View style={styles.emptyBox}>
                <Ionicons name="alert-circle-outline" size={40} color={SUBTEXT} />
                <Text style={styles.emptyTitle}>검색 중 오류가 발생했어요</Text>
                <Text style={styles.emptySub}>잠시 후 다시 시도해주세요</Text>
              </View>
            ) : loading ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator color={SUBTEXT} />
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(p, idx) => `${p.prdlstReportNo || p.prdlstNm}-${idx}`}
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={Platform.OS === 'android'}
                ItemSeparatorComponent={() => <View style={styles.divider} />}
                renderItem={({ item: p }) => <ProductRow p={p} onPress={() => pickProduct(p)} />}
                ListEmptyComponent={
                  <TouchableOpacity style={styles.listRow} onPress={pickManual} activeOpacity={0.7}>
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Text style={{ fontSize: 22 }}>🍱</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listName} numberOfLines={2}>{query}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
                  </TouchableOpacity>
                }
              />
            )
          ) : baseLoading ? (
            <View style={styles.emptyBox}>
              <ActivityIndicator color={SUBTEXT} />
            </View>
          ) : (
            <FlatList
              data={baseProducts}
              keyExtractor={(p, idx) => `${p.prdlstReportNo || p.prdlstNm}-${idx}`}
              ListHeaderComponent={<Text style={styles.baseListHeader}>‘{baseSeed}’ 관련 추천</Text>}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={Platform.OS === 'android'}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              renderItem={({ item: p }) => <ProductRow p={p} onPress={() => pickProduct(p)} />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 32 }}>🤔</Text>
                  <Text style={styles.emptyTitle}>추천할 재료가 없어요</Text>
                  <Text style={styles.emptySub}>위에서 검색해 보세요</Text>
                </View>
              }
            />
          )}
        </>
      )}
    </View>
  );
}

function ProductRow({ p, onPress }: { p: HaccpProduct; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.listRow} onPress={onPress} activeOpacity={0.7}>
      {p.imgurl1 ? (
        <Image source={{ uri: p.imgurl1 }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={{ fontSize: 22 }}>{guessIconFromProduct(p)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.listName} numberOfLines={2}>{p.prdlstNm}</Text>
        <Text style={styles.listMeta} numberOfLines={1}>
          {[p.manufacture, p.capacity].filter(Boolean).join(' · ') || p.prdkind}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C4C4C4" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    position: 'relative',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: SURFACE, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT, paddingVertical: 0 },
  helperText: {
    fontSize: 12, color: SUBTEXT,
    paddingHorizontal: 4, paddingTop: 10, fontWeight: '500',
  },
  baseListHeader: {
    fontSize: 13, color: SUBTEXT, fontWeight: '600',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: SURFACE },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  listName: { fontSize: 14, color: TEXT, fontWeight: '600' },
  listMeta: { fontSize: 12, color: SUBTEXT, marginTop: 3 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginLeft: 76 },
  emptyBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 48, gap: 10,
  },
  emptyTitle: { fontSize: 14, color: SUBTEXT, fontWeight: '600' },
  emptySub: { fontSize: 12, color: SUBTEXT },
  manualBtn: {
    marginTop: 8, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, backgroundColor: TEXT,
  },
  manualBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  pickedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14,
    backgroundColor: SURFACE,
    marginTop: 16, marginBottom: 24,
  },
  pickedThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFFFFF' },
  pickedThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  pickedName: { fontSize: 15, fontWeight: '700', color: TEXT },
  pickedMeta: { fontSize: 12, color: SUBTEXT, marginTop: 4 },
  reselectBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: BORDER,
  },
  reselectText: { fontSize: 12, color: TEXT, fontWeight: '600' },
  fieldLabel: { fontSize: 13, color: SUBTEXT, fontWeight: '600', marginBottom: 8 },
  field: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: TEXT,
    marginBottom: 16,
  },
  gramsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  gramsUnit: { fontSize: 15, color: TEXT, fontWeight: '600', marginBottom: 16 },
  hint: { fontSize: 12, color: SUBTEXT, marginTop: 4 },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  confirmBtn: {
    backgroundColor: '#1BAE74', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#BDBDBD' },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
