import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  TextInput,
  ScrollView,
  SectionList,
  Platform,
} from 'react-native';

const ANDROID_SCALE = 0.88;
const scaled = (n: number) => Platform.OS === 'android' ? n * ANDROID_SCALE : n;
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getFridge,
  removeFridgeItem,
  daysUntilExpiry,
  getExpiryStatusWith,
  resolveStorage,
  moveFridgeItem,
  type FridgeItem,
  type StorageType,
} from '../services/fridge';
import { rebuildExpiryNotifications } from '../services/fridgeNotifications';
import { loadPendingSignup, clearPendingSignup, finalizeSignup } from '../services/signupFlow';
import { loadFridgeSettings, DEFAULT_SETTINGS, type FridgeSettings } from '../services/fridgeSettings';
import { useAuth } from './_layout';
import { ActivityIndicator } from 'react-native';

// ──────── 팔레트 ────────
const TEXT = '#1A1A1A';
const SUBTEXT = '#8E8E93';
const BORDER = '#ECECEC';
const SURFACE = '#F5F5F7';
const URGENT = '#FF3B30';
const SOON = '#FF9500';

type FilterType = 'all' | 'fridge' | 'freezer';
type SortType = 'latest' | 'oldest';

export default function MyFridgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = params.onboarding === '1';
  const { firebaseUser, setIsLoggedIn, setUserProfile } = useAuth();

  const [items, setItems] = useState<FridgeItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('oldest');
  const [finishing, setFinishing] = useState(false);
  const [fridgeSettings, setFridgeSettings] = useState<FridgeSettings>(DEFAULT_SETTINGS);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected([]);
  }, []);

  // 온보딩 플로우 완료 — 계정 생성 + 홈 이동
  const finishOnboarding = useCallback(async () => {
    if (!firebaseUser || finishing) return;
    setFinishing(true);
    try {
      const pending = await loadPendingSignup(firebaseUser.uid);
      if (!pending) {
        Alert.alert('오류', '가입 정보를 찾을 수 없어요. 다시 시도해주세요.');
        router.replace('/(auth)/welcome');
        return;
      }
      const profile = await finalizeSignup(firebaseUser, pending);
      await clearPendingSignup(firebaseUser.uid);
      setUserProfile(profile);
      setIsLoggedIn(true);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('가입 실패', e?.message || '계정 생성에 실패했어요.');
    } finally {
      setFinishing(false);
    }
  }, [firebaseUser, finishing, router, setIsLoggedIn, setUserProfile]);

  const load = useCallback(async () => {
    try {
      const [data, settings] = await Promise.all([getFridge(), loadFridgeSettings()]);
      setItems(data);
      setFridgeSettings(settings);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // 필터링 + 검색
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(i => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      return resolveStorage(i) === filter;
    });
  }, [items, searchQuery, filter]);

  // 섹션 구성: 임박 / 냉장실 / 냉동실
  const sections = useMemo(() => {
    const urgentItems: FridgeItem[] = [];
    const fridgeItems: FridgeItem[] = [];
    const freezerItems: FridgeItem[] = [];

    filtered.forEach(it => {
      const status = getExpiryStatusWith(it.expiresAt, fridgeSettings.urgentDays, fridgeSettings.soonDays);
      if (status === 'expired' || status === 'urgent') {
        urgentItems.push(it);
      } else if (resolveStorage(it) === 'freezer') {
        freezerItems.push(it);
      } else {
        fridgeItems.push(it);
      }
    });

    // 임박 섹션은 항상 유효기간 가까운 순
    const sortByExpiry = (a: FridgeItem, b: FridgeItem) =>
      daysUntilExpiry(a.expiresAt) - daysUntilExpiry(b.expiresAt);

    // 유효기간 기준 정렬
    // 최신순: 유효기간이 먼 미래 먼저 (= 오래 보관 가능한 순)
    // 오래된순: 유효기간이 가까운 것 먼저 (= 빨리 먹어야 할 순)
    const sortByExpiryDate = (a: FridgeItem, b: FridgeItem) => {
      const cmp = (a.expiresAt || '').localeCompare(b.expiresAt || '');
      return sortType === 'latest' ? -cmp : cmp;
    };

    const result: { key: string; title: string; data: FridgeItem[]; tint?: string }[] = [];
    if (urgentItems.length > 0) {
      result.push({
        key: 'urgent',
        title: '유효기간 임박',
        data: urgentItems.sort(sortByExpiry),
        tint: fridgeSettings.colors.urgent,
      });
    }
    if (fridgeItems.length > 0 && filter !== 'freezer') {
      result.push({
        key: 'fridge',
        title: '냉장실',
        data: fridgeItems.sort(sortByExpiryDate),
      });
    }
    if (freezerItems.length > 0 && filter !== 'fridge') {
      result.push({
        key: 'freezer',
        title: '냉동실',
        data: freezerItems.sort(sortByExpiryDate),
      });
    }
    return result;
  }, [filtered, filter, sortType]);

  const totalCount = items.length;
  const urgentCount = useMemo(
    () => items.filter(i => ['expired', 'urgent'].includes(getExpiryStatusWith(i.expiresAt, fridgeSettings.urgentDays, fridgeSettings.soonDays))).length,
    [items, fridgeSettings]
  );

  // ─── 액션 ───
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      // 선택이 모두 풀리면 선택 모드 종료 → 기본 냉장고 뷰로 복귀
      if (next.length === 0 && prev.length > 0) setSelectionMode(false);
      return next;
    });
  };

  const confirmDelete = (item: FridgeItem) => {
    Alert.alert(item.name + ' 삭제', '냉장고에서 제거할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await removeFridgeItem(item.id);
          const remaining = items.filter(i => i.id !== item.id);
          setItems(remaining);
          setSelected(prev => prev.filter(s => s !== item.id));
          try { await rebuildExpiryNotifications(remaining, fridgeSettings); } catch {}
        },
      },
    ]);
  };

  const doMove = async (item: FridgeItem, target: StorageType) => {
    await moveFridgeItem(item.id, target);
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, storage: target } : i)));
  };

  const handleLongPress = (item: FridgeItem) => {
    const current = resolveStorage(item);
    const target: StorageType = current === 'freezer' ? 'fridge' : 'freezer';
    const label = target === 'freezer' ? '냉동실로 이동' : '냉장실로 이동';
    Alert.alert(
      item.name,
      current === 'freezer' ? '냉동실 보관 중' : '냉장실 보관 중',
      [
        { text: '취소', style: 'cancel' },
        { text: label, onPress: () => doMove(item, target) },
        { text: '삭제', style: 'destructive', onPress: () => confirmDelete(item) },
      ]
    );
  };

  const toggleSelectIn = (sectionItemIds: string[]) => {
    const allSelected = sectionItemIds.length > 0 && sectionItemIds.every(id => selected.includes(id));
    if (allSelected) {
      setSelected(prev => {
        const next = prev.filter(id => !sectionItemIds.includes(id));
        if (next.length === 0 && prev.length > 0) setSelectionMode(false);
        return next;
      });
    } else {
      setSelected(prev => Array.from(new Set([...prev, ...sectionItemIds])));
    }
  };

  const deleteIds = (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    const targets = items.filter(i => idsToDelete.includes(i.id));
    Alert.alert(
      `${targets.length}개 재료 삭제`,
      '선택한 재료를 냉장고에서 제거할까요?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            for (const it of targets) {
              await removeFridgeItem(it.id);
            }
            const ids = new Set(targets.map(t => t.id));
            const remaining = items.filter(i => !ids.has(i.id));
            setItems(remaining);
            setSelected(prev => prev.filter(id => !ids.has(id)));
            try { await rebuildExpiryNotifications(remaining, fridgeSettings); } catch {}
          },
        },
      ]
    );
  };

  const goSearchWithSelected = () => {
    if (selected.length === 0) return;
    const names = items.filter(i => selected.includes(i.id)).map(i => i.name);
    router.push({
      pathname: '/(tabs)/recipe',
      params: { ingredients: names.join(','), _t: String(Date.now()) },
    });
  };

  // ─── 렌더 ───
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* 헤더 — 선택 모드 시 전환 */}
      {selectionMode ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={exitSelection}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            style={styles.headerSide}
          >
            <Text style={styles.headerActionText}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} pointerEvents="none">
            {selected.length > 0 ? `${selected.length}개 선택` : '선택'}
          </Text>
          <View style={styles.headerRight}>
            {selected.length > 0 && (
              <TouchableOpacity
                onPress={() => deleteIds(selected)}
                hitSlop={{ top: 20, bottom: 20, left: 12, right: 20 }}
              >
                <Text style={[styles.headerActionText, { color: URGENT }]}>삭제 {selected.length}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          {isOnboarding ? (
            <TouchableOpacity
              onPress={finishOnboarding}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={styles.headerSide}
              disabled={finishing}
            >
              <Text style={[styles.skipBtnText, finishing && { opacity: 0.4 }]}>다음에</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              style={styles.headerSide}
            >
              <Ionicons name="chevron-back" size={26} color={TEXT} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle} pointerEvents="none">냉장고</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => router.push('/fridge-settings')}
              hitSlop={{ top: 20, bottom: 20, left: 12, right: 12 }}
            >
              <Ionicons name="settings-outline" size={20} color={TEXT} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/fridge-add')}
              hitSlop={{ top: 20, bottom: 20, left: 12, right: 20 }}
            >
              <Text style={styles.addBtnText}>재료 추가</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 요약 + 임박 CTA (슬림 1행) */}
      {totalCount > 0 && (
        <View style={styles.topArea}>
          <View style={styles.summaryBar}>
            <View style={styles.summaryStatRow}>
              <Text style={styles.summaryStatText}>
                전체 <Text style={styles.summaryStatStrong}>{totalCount}</Text>개
              </Text>
              {urgentCount > 0 && (
                <>
                  <Text style={styles.summaryStatDot}>·</Text>
                  <View style={styles.summaryUrgentDot} />
                  <Text style={[styles.summaryStatText, { color: fridgeSettings.colors.urgent, fontWeight: '800' }]}>
                    임박 {urgentCount}
                  </Text>
                </>
              )}
            </View>
            {!selectionMode && (
              <TouchableOpacity
                onPress={() => setSelectionMode(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.selectEntryText}>선택</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 검색창 */}
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={SUBTEXT} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="재료 검색"
              placeholderTextColor="#BDBDBD"
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color="#C4C4C4" />
              </TouchableOpacity>
            )}
          </View>

          {/* 필터 칩 + 정렬 */}
          <View style={styles.filterRow}>
            <FilterChip label="전체" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterChip label="냉장실" active={filter === 'fridge'} onPress={() => setFilter('fridge')} />
            <FilterChip label="냉동실" active={filter === 'freezer'} onPress={() => setFilter('freezer')} />
            <TouchableOpacity
              style={styles.sortBtn}
              onPress={() => setSortType(sortType === 'latest' ? 'oldest' : 'latest')}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-vertical" size={scaled(14)} color={TEXT} style={{ marginRight: 4 }} />
              <Text style={styles.sortBtnText}>
                {sortType === 'latest' ? '유통기한 많은순' : '유통기한 적은순'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 리스트 */}
      {sections.length === 0 && !loading ? (
        <EmptyState
          hasItems={totalCount > 0}
          onAdd={() => router.push('/fridge-add')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + (selectionMode && selected.length > 0 ? 100 : 40) }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const sectionItemIds = section.data.map(i => i.id);
            const sectionSelectedCount = sectionItemIds.filter(id => selected.includes(id)).length;
            const allSectionSelected = sectionItemIds.length > 0 && sectionSelectedCount === sectionItemIds.length;
            return (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, section.tint && { color: section.tint }]}>
                  {section.title}
                </Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
                {selectionMode && (
                  <TouchableOpacity
                    style={styles.sectionSelectAllBtn}
                    onPress={() => toggleSelectIn(sectionItemIds)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionSelectAllBtnText}>
                      {allSectionSelected ? '모두 해제' : '모두 선택'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          renderItem={({ item }) => (
            <FridgeRow
              item={item}
              isSelected={selected.includes(item.id)}
              selectionMode={selectionMode}
              onPress={() => {
                if (selectionMode) {
                  toggleSelect(item.id);
                } else {
                  // 첫 탭 = 선택 모드 진입 + 해당 아이템 선택
                  setSelectionMode(true);
                  setSelected([item.id]);
                }
              }}
              onLongPress={() => handleLongPress(item)}
              settings={fridgeSettings}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
        />
      )}

      {/* 하단 액션바 — 선택 모드에서 1개 이상 선택 시 */}
      {selectionMode && selected.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
          <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={goSearchWithSelected}>
            <Ionicons name="search" size={18} color="#FFFFFF" />
            <Text style={styles.ctaBtnText}>{selected.length}개 재료로 레시피 찾기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 온보딩 모드 우측 하단 완료 FAB — 재료가 1개 이상 있을 때만 노출 */}
      {isOnboarding && items.length > 0 && selected.length === 0 && (
        <TouchableOpacity
          style={[styles.onboardingFab, { bottom: insets.bottom + 24 }]}
          onPress={finishOnboarding}
          disabled={finishing}
          activeOpacity={0.85}
        >
          {finishing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              <Text style={styles.onboardingFabText}>완료</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

// ─────────────── 컴포넌트 ───────────────

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
      activeOpacity={0.8}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FridgeRow({
  item,
  isSelected,
  selectionMode,
  onPress,
  onLongPress,
  settings,
}: {
  item: FridgeItem;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
  settings: FridgeSettings;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const status = getExpiryStatusWith(item.expiresAt, settings.urgentDays, settings.soonDays);
  const days = daysUntilExpiry(item.expiresAt);
  const storage = resolveStorage(item);

  const onPressWithBounce = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const expiryLabel =
    days < 0 ? `${Math.abs(days)}일 지남`
    : days === 0 ? '오늘까지'
    : days === 1 ? '내일까지'
    : `${days}일 남음`;
  const expiryColor =
    status === 'expired' ? settings.colors.expired
    : status === 'urgent' ? settings.colors.urgent
    : status === 'soon' ? settings.colors.soon
    : settings.colors.ok;

  const expiryDate = (() => {
    const d = new Date(item.expiresAt);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  })();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected]}
        onPress={onPressWithBounce}
        onLongPress={onLongPress}
        activeOpacity={0.7}
      >
        <View style={[
          styles.rowIconWrap,
          isSelected && styles.rowIconWrapSelected,
          item.imageUrl && styles.rowIconWrapImage,
        ]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.rowImage} contentFit="cover" />
          ) : (
            <Text style={styles.rowIcon}>{item.icon}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.rowMeta}>
            <View style={styles.storagePill}>
              <Text style={styles.storagePillText}>
                {storage === 'freezer' ? '냉동' : '냉장'}
              </Text>
            </View>
            {item.quantity ? (
              <Text style={styles.rowQty}>· {item.quantity}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.rowRight}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.rowExpiry, { color: expiryColor }]}>
              {expiryLabel}
            </Text>
            <Text style={styles.rowExpiryDate}>~ {expiryDate}</Text>
          </View>
          {selectionMode ? (
            isSelected ? (
              <View style={styles.rowCheck}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.rowCheckEmpty} />
            )
          ) : (
            <Ionicons name="chevron-forward" size={16} color="#D0D0D0" />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState({ hasItems, onAdd }: { hasItems: boolean; onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>
        {hasItems ? '검색 결과가 없어요' : '냉장고가 비어있어요'}
      </Text>
      <Text style={styles.emptySub}>
        {hasItems
          ? '다른 필터나 검색어를 시도해보세요'
          : '재료를 추가하고 유효기간도 관리해보세요'}
      </Text>
      {!hasItems && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.emptyBtnText}>재료 추가하기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────── 스타일 ───────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    minHeight: 52,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: -1,
  },
  headerSide: {
    paddingVertical: 6,
    zIndex: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
    zIndex: 2,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  selectEntryText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  // 상단 영역
  topArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 10,
  },
  summaryStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryStatText: {
    fontSize: 14,
    color: TEXT,
    fontWeight: '600',
  },
  summaryStatStrong: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT,
  },
  summaryStatDot: {
    fontSize: 14,
    color: '#DCDCDC',
  },
  summaryUrgentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: URGENT,
    marginRight: 2,
  },
  summaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
  },
  summaryCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SURFACE,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    paddingVertical: 0,
  },

  filterRow: {
    flexDirection: 'row',
    gap: scaled(6),
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: scaled(14),
    paddingVertical: scaled(7),
    borderRadius: 14,
    backgroundColor: SURFACE,
  },
  filterChipActive: {
    backgroundColor: '#1A1A1A',
  },
  filterChipText: {
    fontSize: scaled(13),
    color: '#5A5A5F',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  sortBtnText: {
    fontSize: scaled(13),
    color: TEXT,
    fontWeight: '600',
  },

  // 섹션
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionSelectAllBtn: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionSelectAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
  },
  sectionCount: {
    fontSize: 13,
    color: SUBTEXT,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 76,
  },

  // 재료 row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  rowSelected: {
    backgroundColor: '#FAFAFA',
  },
  rowIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconWrapSelected: {
    backgroundColor: '#F5F5F7',
  },
  rowIconWrapImage: {
    backgroundColor: 'transparent',
  },
  rowIcon: { fontSize: 24 },
  rowImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  storagePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: SURFACE,
  },
  storagePillText: {
    fontSize: 10,
    color: SUBTEXT,
    fontWeight: '700',
  },
  rowQty: {
    fontSize: 12,
    color: SUBTEXT,
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowExpiry: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowExpiryDate: {
    fontSize: 11,
    color: SUBTEXT,
    fontWeight: '500',
    marginTop: 2,
  },
  rowCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1BAE74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCheckEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },

  // 빈 상태
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: TEXT, marginBottom: 6 },
  emptySub: {
    fontSize: 13,
    color: SUBTEXT,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#1BAE74',
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // 하단 액션바
  bottomBar: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1BAE74',
  },
  ctaBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

  skipBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
  },

  onboardingFab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#1BAE74',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  onboardingFabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
