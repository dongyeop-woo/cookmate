import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAuth } from '../_layout';
import { fetchGifticons, exchangeGifticon, fetchUser } from '../../services/api';
import type { Gifticon } from '../../services/api';
import { getCartCount } from '../../services/cart';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const rewardedAdUnitId = __DEV__ ? TestIds.REWARDED : Platform.OS === 'ios'
  ? 'ca-app-pub-8542314434357214/6075268030'
  : 'ca-app-pub-8542314434357214/9224175556';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { key: '전체', icon: 'view-grid-outline' as const, color: '#1A1A1A' },
  { key: '상품권', icon: 'wallet-giftcard' as const, color: '#C9A227' },
  { key: '카페', icon: 'coffee-outline' as const, color: '#8B5E3C' },
  { key: '편의점', icon: 'store-outline' as const, color: '#1A73E8' },
  { key: '배달', icon: 'moped-outline' as const, color: '#2AC1BC' },
  { key: '치킨', icon: 'food-drumstick-outline' as const, color: '#FF9800' },
  { key: '피자', icon: 'pizza' as const, color: '#E53935' },
  { key: '버거', icon: 'hamburger' as const, color: '#6D4C41' },
  { key: '베이커리', icon: 'bread-slice-outline' as const, color: '#F5A623' },
  { key: '영화', icon: 'movie-open-outline' as const, color: '#5C6BC0' },
  { key: '마트', icon: 'cart-outline' as const, color: '#2E7D32' },
  { key: '기타', icon: 'dots-horizontal' as const, color: '#999' },
];

const SUB_CATEGORIES: Record<string, string[]> = {
  '상품권': ['전체', '신세계', '네이버페이', '도서'],
  '카페': ['전체', '스타벅스', '투썸플레이스', '이디야', '컴포즈', '할리스'],
  '편의점': ['전체', 'CU', 'GS25', '세븐일레븐'],
  '배달': ['전체', '배달의민족'],
  '치킨': ['전체', 'BHC', 'BBQ', '교촌', '굽네'],
  '피자': ['전체', '도미노', '미스터피자'],
  '버거': ['전체', '맥도날드', '버거킹', '롯데리아', '맘스터치'],
  '베이커리': ['전체', '파리바게뜨', '뚜레쥬르', '던킨'],
  '영화': ['전체', 'CGV', '메가박스', '롯데시네마'],
  '마트': ['전체', '이마트', '홈플러스'],
  '기타': ['전체', '다이소', '도서', '통신'],
};

const QUICK_MENUS = [
  { icon: 'star' as const, color: '#F5A623', bg: '#FEF3E2', label: '포인트 적립', route: '/community/write' },
  { icon: 'receipt-outline' as const, color: '#1A1A1A', bg: '#E8F5EE', label: '내 포인트', route: '/my-points' },
  { icon: 'pricetag-outline' as const, color: '#FF6B6B', bg: '#FFF0F0', label: '오늘의 딜', route: null },
  { icon: 'megaphone-outline' as const, color: '#2196F3', bg: '#E3F2FD', label: '이벤트', route: '/announcements' },
];

export default function ShopScreen() {
  const router = useRouter();
  const { userProfile, firebaseUser, setUserProfile, isPremium } = useAuth();
  const [gifticons, setGifticons] = useState<Gifticon[]>([]);
  const [points, setPoints] = useState(userProfile?.points ?? 0);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedSub, setSelectedSub] = useState('전체');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'asc' | 'desc'>('default');
  const searchRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const reloadShop = useCallback(async () => {
    try {
      const [list, fresh, count] = await Promise.all([
        fetchGifticons(),
        firebaseUser?.uid ? fetchUser(firebaseUser.uid) : null,
        getCartCount(),
      ]);
      setGifticons(list);
      if (fresh) setPoints(fresh.points ?? 0);
      setCartCount(count);
      // 첫 화면에 보일 기프티콘 이미지 prefetch — 디스크 캐시 워밍 (백그라운드)
      try {
        const urls = list.slice(0, 20).map(g => g.image).filter(Boolean);
        if (urls.length) Image.prefetch(urls, 'disk');
      } catch {}
    } catch (e) {
      console.warn('기프티콘 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.uid]);

  useFocusEffect(
    useCallback(() => {
      reloadShop();
    }, [reloadShop])
  );

  const handleLogoPress = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    reloadShop();
  }, [reloadShop]);

  const matchCategory = (g: Gifticon, cat: string): boolean => {
    const brand = (g.brand || '').toLowerCase();
    const name = (g.name || '').toLowerCase();
    const category = (g.category || '').toLowerCase();
    const text = brand + ' ' + name + ' ' + category;
    switch (cat) {
      case '상품권': return text.includes('상품권') || text.includes('네이버페이') || text.includes('신세계');
      case '카페': return text.includes('스타벅스') || text.includes('투썸') || text.includes('이디야') || text.includes('메가커피') || text.includes('컴포즈') || text.includes('할리스') || text.includes('커피');
      case '편의점': return text.includes('cu') || text.includes('gs25') || text.includes('세븐일레븐') || text.includes('이마트24') || text.includes('미니스톱') || text.includes('편의점');
      case '배달': return text.includes('배달의민족') || text.includes('배민') || text.includes('요기요') || text.includes('쿠팡이츠');
      case '치킨': return text.includes('bhc') || text.includes('bbq') || text.includes('교촌') || text.includes('굽네') || text.includes('푸라닭') || text.includes('치킨');
      case '피자': return text.includes('도미노') || text.includes('피자헛') || text.includes('미스터피자') || text.includes('피자');
      case '버거': return text.includes('맥도날드') || text.includes('버거킹') || text.includes('롯데리아') || text.includes('맘스터치') || text.includes('kfc') || text.includes('버거');
      case '베이커리': return text.includes('파리바게뜨') || text.includes('뚜레쥬르') || text.includes('던킨') || text.includes('빵');
      case '영화': return text.includes('cgv') || text.includes('메가박스') || text.includes('롯데시네마') || text.includes('영화');
      case '마트': return text.includes('이마트') && !text.includes('이마트24') || text.includes('홈플러스') || text.includes('롯데마트');
      case '기타': return text.includes('교보문고') || text.includes('yes24') || text.includes('예스24') || text.includes('문화상품권') || text.includes('컬쳐랜드') || text.includes('도서') || text.includes('배스킨') || text.includes('설빙') || text.includes('아이스크림') || text.includes('다이소') || text.includes('skt') || text.includes('kt') || text.includes('lg u+') || text.includes('통신') || !['상품권','카페','편의점','배달','치킨','피자','버거','베이커리','영화','마트'].some(c => matchCategory(g, c));
      default: return true;
    }
  };

  const filtered = useMemo(() => {
    let result = gifticons;
    if (selectedCategory !== '전체') {
      result = result.filter(g => matchCategory(g, selectedCategory));
    }
    if (selectedSub !== '전체') {
      const q = selectedSub.toLowerCase();
      result = result.filter(g =>
        (g.brand || '').toLowerCase().includes(q) || (g.name || '').toLowerCase().includes(q)
      );
    }
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) || g.brand.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'asc') {
      result = [...result].sort((a, b) => a.pointCost - b.pointCost);
    } else if (sortBy === 'desc') {
      result = [...result].sort((a, b) => b.pointCost - a.pointCost);
    } else {
      // 추천순: 가격대를 3등분해 저가/중가/고가를 번갈아 섞어 사용자 의욕 유지
      const sorted = [...result].sort((a, b) => a.pointCost - b.pointCost);
      const third = Math.ceil(sorted.length / 3);
      const low = sorted.slice(0, third);
      const mid = sorted.slice(third, third * 2);
      const high = sorted.slice(third * 2);
      const mixed: typeof result = [];
      const maxLen = Math.max(low.length, mid.length, high.length);
      for (let i = 0; i < maxLen; i++) {
        if (low[i]) mixed.push(low[i]);
        if (mid[i]) mixed.push(mid[i]);
        if (high[i]) mixed.push(high[i]);
      }
      result = mixed;
    }
    return result;
  }, [gifticons, selectedCategory, selectedSub, searchText, sortBy]);

  const handleExchange = (gifticon: Gifticon) => {
    if (points < gifticon.pointCost) {
      Alert.alert('포인트 부족', `${(gifticon.pointCost - points).toLocaleString()}P가 더 필요해요.`);
      return;
    }
    Alert.alert(
      '기프티콘 교환',
      `${gifticon.name}을(를) ${gifticon.pointCost.toLocaleString()}P로 교환할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '교환하기',
          onPress: async () => {
            if (!firebaseUser?.uid) return;

            // 보상형 광고 1회 시청 (프리미엄 유저는 스킵)
            if (!isPremium) try {
              await new Promise<void>((resolve) => {
                const rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId);
                const unsubs: Array<() => void> = [];
                let settled = false;
                const cleanup = () => {
                  if (settled) return;
                  settled = true;
                  unsubs.forEach(u => { try { u(); } catch {} });
                  resolve();
                };
                unsubs.push(rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
                  rewarded.show();
                }));
                unsubs.push(rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
                  // 보상 획득 — 교환은 광고가 실제로 닫힌 뒤 진행
                }));
                unsubs.push(rewarded.addAdEventListener(AdEventType.CLOSED, cleanup));
                unsubs.push(rewarded.addAdEventListener(AdEventType.ERROR, cleanup));
                rewarded.load();
                setTimeout(cleanup, 15000);
              });
            } catch {
              // 광고 실패 시에도 교환 진행
            }

            setExchanging(gifticon.id);
            try {
              await exchangeGifticon(firebaseUser.uid, gifticon.id);
              const fresh = await fetchUser(firebaseUser.uid);
              if (fresh) {
                setPoints(fresh.points ?? 0);
                setUserProfile(fresh as any);
              }
              setGifticons(prev =>
                prev.map(g => g.id === gifticon.id ? { ...g, stock: g.stock - 1 } : g)
              );
              Alert.alert('교환 완료!', `${gifticon.name} 기프티콘이 발급되었어요. 내 기프티콘에서 확인하세요.`, [
                { text: '나중에', style: 'cancel' },
                { text: '내 기프티콘 보기', onPress: () => router.push('/my-gifticons') },
              ]);
            } catch (e: any) {
              Alert.alert('교환 실패', e.message || '다시 시도해주세요.');
            } finally {
              setExchanging(null);
            }
          },
        },
      ]
    );
  };

  const ListHeader = useMemo(() => (
    <View>
      {/* 포인트 배너 */}
      <View style={styles.banner}>
        <Image source={require('../../assets/shoppingbanner1.jpg')} style={styles.bannerImage} contentFit="cover" />
      </View>

      {/* 구분선 */}
      <View style={[styles.divider, { marginTop: 0 }]} />

      {/* 카테고리 아이콘 행 */}
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={styles.categoryItem}
            onPress={() => { setSelectedCategory(cat.key); setSelectedSub('전체'); }}
            activeOpacity={0.7}
          >
            <View style={[
              styles.categoryIcon,
              selectedCategory === cat.key && styles.categoryIconActive,
            ]}>
              <MaterialCommunityIcons name={cat.icon as any} size={24} color={selectedCategory === cat.key ? '#1BAE74' : cat.color} />
            </View>
            <Text style={[
              styles.categoryLabel,
              selectedCategory === cat.key && styles.categoryLabelActive,
            ]}>{cat.key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 구분선 */}
      <View style={styles.divider} />

      {/* 결과 헤더 */}
      <View style={styles.resultHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={styles.resultTitle}>
            {selectedCategory === '전체' ? '전체 상품' : selectedCategory}
          </Text>
          <Text style={styles.resultCount}>{filtered.length}개</Text>
        </View>
        <View style={styles.sortRow}>
          <TouchableOpacity onPress={() => setSortBy('default')} style={styles.sortBtn}>
            <Text style={[styles.sortText, sortBy === 'default' && styles.sortTextActive]}>추천순</Text>
          </TouchableOpacity>
          <Text style={styles.sortDot}>·</Text>
          <TouchableOpacity onPress={() => setSortBy('asc')} style={styles.sortBtn}>
            <Text style={[styles.sortText, sortBy === 'asc' && styles.sortTextActive]}>낮은순</Text>
          </TouchableOpacity>
          <Text style={styles.sortDot}>·</Text>
          <TouchableOpacity onPress={() => setSortBy('desc')} style={styles.sortBtn}>
            <Text style={[styles.sortText, sortBy === 'desc' && styles.sortTextActive]}>높은순</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 서브 카테고리 */}
      {SUB_CATEGORIES[selectedCategory] && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subCategoryRow}>
          {SUB_CATEGORIES[selectedCategory].map((sub) => (
            <TouchableOpacity
              key={sub}
              onPress={() => setSelectedSub(sub)}
              style={[styles.subChip, selectedSub === sub && styles.subChipActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.subChipText, selectedSub === sub && styles.subChipTextActive]}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  ), [selectedCategory, selectedSub, sortBy, filtered.length]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 - 로고 + 검색 + 포인트 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Image source={require('../../assets/appIcon-padded.png')} style={styles.headerLogoIcon} />
        </TouchableOpacity>
        <LinearGradient
          colors={['#A8E8C4', '#5FB896']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.headerSearchBarGradient}
        >
          <TouchableOpacity
            style={styles.headerSearchBar}
            activeOpacity={0.7}
            onPress={() => router.push('/search')}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={11} cy={11} r={8} />
              <Line x1={21} y1={21} x2={16.65} y2={16.65} />
            </Svg>
            <Text style={styles.headerSearchPlaceholder} numberOfLines={1}>브랜드, 상품명 검색</Text>
          </TouchableOpacity>
        </LinearGradient>
        <TouchableOpacity onPress={() => router.push('/my-points')} style={styles.pointChip} activeOpacity={0.7}>
          <Ionicons name="wallet" size={14} color="#1BAE74" />
          <Text style={styles.pointChipText}>{points.toLocaleString()}P</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/my-gifticons')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 8 }}>
          <Ionicons name="gift-outline" size={24} color="#FF6B9D" />
        </TouchableOpacity>
        <View style={{ marginLeft: 8, marginTop: 4 }}>
          <TouchableOpacity onPress={() => router.push('/cart')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="cart-outline" size={24} color="#FF6B9D" />
          </TouchableOpacity>
          {cartCount > 0 && (
            <View style={styles.cartBadge} pointerEvents="none">
              <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#1A1A1A" />
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          ListHeaderComponent={ListHeader}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
          scrollEventThrottle={100}
          renderItem={({ item }) => {
            const canAfford = points >= item.pointCost;
            const outOfStock = item.stock <= 0;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => !outOfStock && router.push(`/gifticon/${item.id}`)}
                disabled={outOfStock}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.cardImage} cachePolicy="disk" recyclingKey={`gift-${item.id}`} contentFit="cover" priority="high" />
                ) : (
                  <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                    <Ionicons name="gift" size={36} color="#DCDCDC" />
                  </View>
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardBrand}>{item.brand}</Text>
                  <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
                  {(() => {
                    const discountRate = item.salePrice > 0
                      ? Math.round(((item.salePrice - item.pointCost) / item.salePrice) * 100)
                      : 0;
                    return (
                      <>
                        {discountRate > 0 && (
                          <Text style={styles.cardOriginalPrice}>{item.salePrice.toLocaleString()}P</Text>
                        )}
                        <View style={styles.priceRow}>
                          {discountRate > 0 && <Text style={styles.cardDiscount}>{discountRate}%</Text>}
                          <Text style={styles.cardCost}>{item.pointCost.toLocaleString()}P</Text>
                        </View>
                      </>
                    );
                  })()}
                  {!outOfStock && !canAfford && (
                    <Text style={styles.cardShortage}>{(item.pointCost - points).toLocaleString()}P 더 필요</Text>
                  )}
                </View>
                {outOfStock && (
                  <View style={styles.soldOutOverlay}>
                    <View style={styles.soldOutBadge}>
                      <Text style={styles.soldOutText}>SOLD OUT</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={52} color="#E0E0E0" />
              <Text style={styles.emptyTitle}>
                {searchText || selectedCategory !== '전체'
                  ? '조건에 맞는 상품이 없어요'
                  : '곧 다양한 상품이 추가돼요!'}
              </Text>
              <Text style={styles.emptySub}>레시피를 올려 포인트를 모아보세요</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopBtn}
          activeOpacity={0.8}
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E91E63',
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 56,
    marginTop: 10,
  },
  headerLogoIcon: {
    width: 50,
    height: 50,
  },
  headerSearchBarGradient: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    padding: 1,
    marginLeft: 4,
    marginRight: 10,
  },
  headerSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    paddingHorizontal: 14,
    overflow: 'hidden',
    gap: 8,
  },
  headerSearchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#6B6B6B',
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    padding: 0,
    margin: 0,
    marginLeft: 6,
    includeFontPadding: false,
    ...Platform.select({
      android: { textAlignVertical: 'center' },
    }),
  },
  pointChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  pointChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1BAE74',
  },

  // 검색 (legacy)
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    paddingVertical: 0,
  },

  // 배너
  banner: {
    marginTop: 10,
    overflow: 'hidden',
    height: width * 0.42,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerContent: {
    flex: 1,
  },
  bannerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  bannerDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
  bannerPointBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    marginLeft: 12,
  },
  bannerPointLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  bannerPointAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },

  // 퀵 메뉴
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  quickItem: {
    alignItems: 'center',
    gap: 8,
  },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 11,
    color: '#444',
    fontWeight: '500',
  },

  // 카테고리
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Platform.OS === 'android' ? 12 : 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  categoryItem: {
    alignItems: 'center',
    gap: Platform.OS === 'android' ? 8 : 6,
    width: '16.666%',
    marginBottom: Platform.OS === 'android' ? 18 : 12,
  },
  categoryIcon: {
    width: Platform.OS === 'android' ? 42 : 52,
    height: Platform.OS === 'android' ? 42 : 52,
    borderRadius: 14,
    backgroundColor: '#F5F2ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryIconActive: {
    backgroundColor: '#E8F7EE',
  },
  categoryLabel: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
  },
  categoryLabelActive: {
    color: '#1BAE74',
    fontWeight: '700',
  },

  // 구분선
  subCategoryRow: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 10,
  },
  subChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  subChipActive: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  subChipText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  subChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  divider: {
    height: 8,
    backgroundColor: '#FAFAFA',
    marginTop: 18,
    marginBottom: 18,
  },

  // 결과 헤더
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  sortText: {
    fontSize: 13,
    color: '#BBB',
    fontWeight: '500',
  },
  sortTextActive: {
    color: '#1A1A1A',
    fontWeight: '700',
  },
  sortDot: {
    fontSize: 12,
    color: '#E0E0E0',
    marginHorizontal: 2,
  },
  resultCount: {
    fontSize: 13,
    color: '#BBB',
  },

  // 그리드
  gridContent: {
    paddingHorizontal: 0,
  },
  gridRow: {
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },

  // 카드
  card: {
    width: (width - 42) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  cardImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  cardBrand: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginBottom: 3,
  },
  cardName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardCost: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  cardDiscount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF3B30',
  },
  cardOriginalPrice: {
    fontSize: 12,
    color: '#BBB',
    textDecorationLine: 'line-through',
  },
  cardShortage: {
    fontSize: 11,
    color: '#FF6B6B',
    fontWeight: '500',
    marginTop: 3,
  },
  cardExchangeable: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5EE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  cardExchangeableText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  soldOutBadge: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  soldOutText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#999',
    letterSpacing: 1,
  },

  // 빈 상태
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999',
  },
  emptySub: {
    fontSize: 13,
    color: '#BDBDBD',
  },
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
});
