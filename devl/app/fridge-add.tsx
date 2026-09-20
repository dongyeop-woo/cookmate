import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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

const SEED_KEYWORDS = [
  '우유', '치즈', '요거트', '버터',
  '돼지고기', '소고기', '닭고기', '참치', '연어', '햄', '소시지',
  '김치', '두부', '계란', '떡', '빵', '면',
  '감자', '양파', '당근', '고추', '토마토',
  '고추장', '된장', '간장', '참기름', '식초',
  '과자', '초콜릿', '라면', '만두', '아이스크림',
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FridgeAddSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HaccpProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [baseProducts, setBaseProducts] = useState<HaccpProduct[]>([]);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseSeed] = useState(() => pickRandom(SEED_KEYWORDS));

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
      // 결과 0개이면 failed-search 이벤트 기록 (콘텐츠 확충 힌트)
      if (!r.error && r.items.length === 0) {
        trackFailedSearch(q, 'ingredient');
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  const pickProduct = (p: HaccpProduct) => {
    const qs = new URLSearchParams({
      prdlstReportNo: p.prdlstReportNo ?? '',
      prdlstNm: p.prdlstNm ?? '',
      prdkind: p.prdkind ?? '',
      prdkindState: p.prdkindState ?? '',
      capacity: p.capacity ?? '',
      imgurl1: p.imgurl1 ?? '',
    }).toString();
    router.push(`/fridge-add-details?${qs}` as any);
  };

  const isSearching = query.trim().length >= 1;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>재료 추가</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

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
        <SearchResults
          loading={loading}
          results={results}
          error={error}
          onPickProduct={pickProduct}
        />
      ) : (
        <BaseList
          products={baseProducts}
          loading={baseLoading}
          seed={baseSeed}
          onPickProduct={pickProduct}
        />
      )}
    </View>
  );
}

function BaseList({
  products,
  loading,
  seed,
  onPickProduct,
}: {
  products: HaccpProduct[];
  loading: boolean;
  seed: string;
  onPickProduct: (p: HaccpProduct) => void;
}) {
  if (loading) {
    return (
      <View style={styles.emptyBox}>
        <ActivityIndicator color={SUBTEXT} />
      </View>
    );
  }
  if (products.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={{ fontSize: 32 }}>🤔</Text>
        <Text style={styles.emptyTitle}>추천할 재료가 없어요</Text>
        <Text style={styles.emptySub}>위에서 검색해 보세요</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={products}
      keyExtractor={(p) => p.prdlstReportNo || p.prdlstNm}
      ListHeaderComponent={
        <Text style={styles.baseListHeader}>‘{seed}’ 관련 추천</Text>
      }
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      renderItem={({ item: p }) => <ProductRow p={p} onPress={() => onPickProduct(p)} />}
    />
  );
}

function SearchResults({
  loading,
  results,
  error,
  onPickProduct,
}: {
  loading: boolean;
  results: HaccpProduct[];
  error: string | null;
  onPickProduct: (p: HaccpProduct) => void;
}) {
  if (error) {
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="alert-circle-outline" size={40} color={SUBTEXT} />
        <Text style={styles.emptyTitle}>검색 중 오류가 발생했어요</Text>
        <Text style={styles.emptySub}>잠시 후 다시 시도해주세요</Text>
      </View>
    );
  }
  if (!loading && results.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={{ fontSize: 36 }}>🔍</Text>
        <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
        <Text style={styles.emptySub}>이름을 다르게 입력해보세요</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={results}
      keyExtractor={(p) => p.prdlstReportNo || p.prdlstNm}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      ItemSeparatorComponent={() => <View style={styles.divider} />}
      renderItem={({ item: p }) => <ProductRow p={p} onPress={() => onPickProduct(p)} />}
    />
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
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SURFACE,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    paddingVertical: 0,
  },
  helperText: {
    fontSize: 12,
    color: SUBTEXT,
    paddingHorizontal: 4,
    paddingTop: 10,
    fontWeight: '500',
  },
  baseListHeader: {
    fontSize: 13,
    color: SUBTEXT,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: SURFACE,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
  },
  listMeta: {
    fontSize: 12,
    color: SUBTEXT,
    marginTop: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 80,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    color: TEXT,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: SUBTEXT,
  },
});
