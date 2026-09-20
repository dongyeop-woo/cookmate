import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Animated,
  Platform,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AttendanceToast from '../../components/AttendanceModal';
import WelcomeToast from '../../components/WelcomeModal';
import DailyChallengeBar from '../../components/DailyChallengeBar';
import { fetchTodayChallenges, completeChallenge, type ChallengeToday } from '../../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { fetchRecipes, fetchCommunityRecipes, likeRecipeUser, unlikeRecipeUser, fetchUser, fetchTopUsers } from '../../services/api';
import type { UserProfile } from '../../services/api';
import { isRemoteProfileImage } from '../../services/profileImage';
import type { Recipe, Category } from '../../constants/recipes';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAuth } from '../_layout';
import { getUnreadCount, markAllNotificationsRead } from '../notifications';
import { getFridge, daysUntilExpiry, getExpiryStatusWith, resolveStorage, type FridgeItem } from '../../services/fridge';
import { loadFridgeSettings, DEFAULT_SETTINGS, type FridgeSettings } from '../../services/fridgeSettings';
import { mark, timed, timeSync } from '../../services/perf';

mark('home:module-load');

// AI 그라데이션 (ai-recommend.tsx와 동일 — 블루 → 퍼플 → 핑크)
const AI_GRADIENT: readonly [string, string, string] = ['#4796E3', '#9168C0', '#D96570'];

const categoryIcons: Record<string, any> = {
  '아침': require('../../assets/icons/categories/breakfast.png'),
  '점심': require('../../assets/icons/categories/lunch.png'),
  '저녁': require('../../assets/icons/categories/dinner.png'),
  '디저트': require('../../assets/icons/categories/dessert.png'),
  '간식': require('../../assets/icons/categories/snack.png'),
  '음료': require('../../assets/icons/categories/drink.png'),
  '야식': require('../../assets/icons/categories/midnight.png'),
  '분식': require('../../assets/icons/categories/street-food.png'),
  '한식': require('../../assets/icons/categories/korean.png'),
  '양식': require('../../assets/icons/categories/western.png'),
};

// 홈 카테고리 — fetchCategories API 응답을 기다리지 않고 즉시 렌더되도록 하드코딩.
// 모든 아이콘은 categoryIcons 로컬 PNG로 처리되므로 API 의존 불필요.
const HOME_CATEGORIES: Category[] = [
  { id: 'breakfast', name: '아침', icon: '🍳', color: '#FFE6B3' },
  { id: 'lunch', name: '점심', icon: '🍱', color: '#FFD0A1' },
  { id: 'dinner', name: '저녁', icon: '🍲', color: '#FFB89A' },
  { id: 'dessert', name: '디저트', icon: '🍰', color: '#FFC7DC' },
  { id: 'snack', name: '간식', icon: '🍪', color: '#F5E0A8' },
  { id: 'drink', name: '음료', icon: '🥤', color: '#B8E0D2' },
  { id: 'midnight', name: '야식', icon: '🍜', color: '#D4C5E8' },
  { id: 'bunsik', name: '분식', icon: '🍢', color: '#FFCCB6' },
  { id: 'korean', name: '한식', icon: '🍚', color: '#FFE0B2' },
  { id: 'western', name: '양식', icon: '🍝', color: '#FFD89E' },
];

const defaultAvatarAsset = require('../../assets/logo-removebg-preview.png');

const { width } = Dimensions.get('window');
// Android 화면 폭(DP)이 iOS pt보다 작아 기본 크기로는 작게 보임 — width scale 보정까지 고려해 살짝 업스케일
const ANDROID_SCALE = 1.1;
// 냉장고 미리보기 전용: 기기 폭 비례 스케일 (iPhone 14 = 390 기준)
const FRIDGE_BASE_W = 390;
const IS_TABLET = width >= 600;
// 태블릿은 상한을 풀어 기기 폭에 비례, 폰은 1.15까지 제한해 과도한 확대 방지
const fridgeWidthScale = IS_TABLET
  ? Math.min(width / FRIDGE_BASE_W, 2.0)
  : Math.min(Math.max(width / FRIDGE_BASE_W, 0.8), 1.15);
const fridgeScaled = (n: number) => {
  const base = Platform.OS === 'android' ? n * ANDROID_SCALE : n;
  return base * fridgeWidthScale;
};
// 기기 폭에 따라 냉장고 배너가 표시할 수 있는 최대 pill 개수 — 최소 2개 보장
const MAX_FRIDGE_PILLS = (() => {
  const BANNER_OUTER_H = 32; // marginHorizontal 16 양쪽
  const BANNER_PAD_H = 28;   // padding 14 양쪽
  const PILLROW_PAD_H = fridgeScaled(20); // paddingHorizontal 10 양쪽
  const RIGHT_AREA_W = fridgeScaled(55);  // 토글 + chevron + 여백
  const PILL_W = fridgeScaled(64);        // pill 60 + gap 4
  const innerW = width - BANNER_OUTER_H - BANNER_PAD_H - PILLROW_PAD_H - RIGHT_AREA_W;
  return Math.max(2, Math.floor(innerW / PILL_W));
})();
const PIXEL_RATIO = Math.ceil(Dimensions.get('window').scale);

const hiResImage = (uri: string, w = 400) => {
  if (uri && uri.includes('unsplash.com')) {
    return uri.replace(/[?&]w=\d+/, `?w=${w}`);
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
// 마지막 글자 받침 유무로 을/를 선택
const josaEulReul = (word: string) => {
  if (!word) return '를';
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return '를';
  return (last - 0xac00) % 28 !== 0 ? '을' : '를';
};

// --- Stack Ad Card (BVLGARI 스타일) ---
const STACK_ADS = [
  {
    image: require('../../assets/banner-kakao.jpg'),
    title: '요잘알 x 카카오톡',
    subtitle: '채널 친구 추가하면 500P 즉시 지급',
    route: '/event-kakao',
  },
  {
    image: require('../../assets/banner2.jpg'),
    title: '요잘알 프리미엄',
    subtitle: '광고 없이 쾌적하게',
    route: '/premium',
  },
];

const STACK_PEEK = 14; // 좌/우로 살짝 보이는 다음/이전 카드 너비
const STACK_GAP = 6;   // 카드 사이 간격
const STACK_CARD_W = width - 32 - STACK_PEEK * 2; // 16px 좌우 사이드 여백 + peek
const STACK_SNAP = STACK_CARD_W + STACK_GAP * 2;

const STACK_LOOP_REPEAT = 3;
const STACK_LOOPED = Array(STACK_LOOP_REPEAT).fill(STACK_ADS).flat() as typeof STACK_ADS;
const STACK_N = STACK_ADS.length;
const STACK_MIDDLE_START = STACK_N; // 중간 세트의 시작 인덱스

const STACK_INTERVAL_MS = 5000;

const StackAdCard = memo(({ router }: { router: ReturnType<typeof useRouter> }) => {
  const [virtualIndex, setVirtualIndex] = useState(STACK_MIDDLE_START);
  const [isPaused, setIsPaused] = useState(false);
  const flatListRef = useRef<FlatList<typeof STACK_ADS[number]>>(null);
  const isInteractingRef = useRef(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const cycleAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const realIndex = virtualIndex % STACK_N;

  const advance = useCallback(() => {
    setVirtualIndex((prev) => {
      const next = prev + 1;
      flatListRef.current?.scrollToOffset({ offset: next * STACK_SNAP, animated: true });
      return next;
    });
  }, []);

  const startCycle = useCallback(() => {
    progressAnim.setValue(0);
    // useNativeDriver: true — scaleX 트랜스폼이라 네이티브 드라이버 사용 가능.
    // 매 프레임 JS↔Native 브릿지 호출이 사라져 Android 보급형에서 스크롤/유휴 jank 큰 폭 감소.
    cycleAnimRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STACK_INTERVAL_MS,
      useNativeDriver: true,
    });
    cycleAnimRef.current.start(({ finished }) => {
      if (finished) {
        if (!isInteractingRef.current) advance();
        startCycle();
      }
    });
  }, [progressAnim, advance]);

  useEffect(() => {
    if (isPaused) {
      cycleAnimRef.current?.stop();
    } else {
      startCycle();
    }
    return () => {
      cycleAnimRef.current?.stop();
    };
  }, [isPaused, startCycle]);

  const normalizeIfOutOfMiddle = useCallback((idx: number) => {
    // 중간 세트(STACK_N ~ 2*STACK_N - 1) 밖이면 같은 카드의 중간 세트 위치로 silent jump
    if (idx < STACK_N || idx >= 2 * STACK_N) {
      const target = STACK_N + ((idx % STACK_N) + STACK_N) % STACK_N;
      flatListRef.current?.scrollToOffset({ offset: target * STACK_SNAP, animated: false });
      setVirtualIndex(target);
    }
  }, []);

  return (
    <View style={styles.stackContainer}>
      <FlatList
        ref={flatListRef}
        data={STACK_LOOPED}
        keyExtractor={(_, i) => String(i)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STACK_SNAP}
        decelerationRate="fast"
        initialScrollIndex={STACK_MIDDLE_START}
        contentContainerStyle={{ paddingHorizontal: 16 + STACK_PEEK - STACK_GAP }}
        onScrollBeginDrag={() => { isInteractingRef.current = true; }}
        onMomentumScrollEnd={(e) => {
          isInteractingRef.current = false;
          const idx = Math.round(e.nativeEvent.contentOffset.x / STACK_SNAP);
          setVirtualIndex(idx);
          normalizeIfOutOfMiddle(idx);
        }}
        getItemLayout={(_, index) => ({
          length: STACK_SNAP,
          offset: STACK_SNAP * index,
          index,
        })}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.stackCard}
            activeOpacity={0.95}
            onPress={() => router.push(item.route as any)}
          >
            <Image
              source={item.image}
              style={styles.stackBgImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </TouchableOpacity>
        )}
      />

      {/* 페이지 인디케이터 — NOL 스타일 (재생/진행바/카운터) */}
      <View style={styles.stackIndicatorWrap}>
        <View style={styles.stackIndicator}>
          <TouchableOpacity onPress={() => setIsPaused((p) => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
            <Ionicons name={isPaused ? 'play' : 'pause'} size={11} color="#666" />
          </TouchableOpacity>
          <View style={styles.indicatorProgressTrack}>
            <Animated.View
              style={[
                styles.indicatorProgressFill,
                {
                  // scaleX + transformOrigin: 'left' 로 width 보간과 동일한 시각 효과를 얻으면서
                  // useNativeDriver: true 사용 가능 (width는 native driver 미지원).
                  transformOrigin: 'left' as any,
                  transform: [{ scaleX: progressAnim }],
                },
              ]}
            />
          </View>
          <Text style={styles.indicatorText}>
            {String(realIndex + 1).padStart(2, '0')} / {String(STACK_N).padStart(2, '0')}
          </Text>
        </View>
      </View>
    </View>
  );
});

// --- Memoized horizontal list item components ---
const BestRecipeCard = memo(({ recipe, idx, onPress, authorImage }: { recipe: Recipe; idx: number; onPress: () => void; authorImage?: string; onAuthorPress?: () => void }) => (
  <TouchableOpacity style={styles.bestCard} onPress={onPress} activeOpacity={0.9}>
    <Image source={{ uri: hiResImage(recipe.image) }} style={styles.bestImage} cachePolicy="disk" recyclingKey={`best-${recipe.id}`} contentFit="cover" priority="high" />
    {/* 하단 그라데이션 오버레이 */}
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.bestGradient} />
    <View style={styles.bestInfoOverlay}>
      <Text style={styles.bestCategory}>{recipe.category}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={[styles.bestTitle, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{recipe.title}</Text>
        <Text style={[styles.bestRating, { color: '#FFFFFF', flexShrink: 0 }]} numberOfLines={1}><Ionicons name="star" size={11} color="#FFB800" /> {(recipe.reviewAvgRating ?? 0).toFixed(1)} ({(recipe.reviewCount ?? 0) > 99 ? '99+' : (recipe.reviewCount ?? 0)})</Text>
      </View>
      <View style={styles.bestMeta}>
        <Text style={styles.bestRating}><Ionicons name="heart" size={11} color="#FF6B6B" /> {recipe.likes ?? 0}</Text>
        <Text style={styles.bestTime}><Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.6)" /> {recipe.time}분</Text>
        <Text style={[styles.bestDifficulty, { color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{recipe.difficulty}</Text>
        <View style={styles.bestAuthorInlineWrap}>
          <Image
            source={authorImage ? { uri: authorImage } : defaultAvatarAsset}
            style={styles.bestAuthorInlineAvatar}
            contentFit="cover"
          />
          <Text style={styles.bestAuthorInline} numberOfLines={1}>{recipe.author}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
), (prev, next) => prev.recipe.id === next.recipe.id && prev.recipe.likes === next.recipe.likes && prev.recipe.reviewAvgRating === next.recipe.reviewAvgRating && prev.recipe.reviewCount === next.recipe.reviewCount && prev.authorImage === next.authorImage);

// 인기 셰프 레시피 카드 — chefPick 섹션 전용. inline JSX이면 부모 리렌더 시 매번 재생성.
// 메모로 추출해 부모 리렌더가 카드까지 cascade 하지 않도록 차단.
const ChefPickCard = memo(({ recipe, onPress, authorImage }: { recipe: Recipe; onPress: () => void; authorImage?: string }) => (
  <TouchableOpacity style={styles.chefPickCard} activeOpacity={0.85} onPress={onPress}>
    <View style={styles.chefPickImageWrap}>
      <Image source={{ uri: hiResImage(recipe.image) }} style={styles.chefPickImage} cachePolicy="disk" recyclingKey={`chef-${recipe.id}`} contentFit="cover" priority="high" />
    </View>
    <View style={styles.recipeNameRow}>
      <Text style={styles.chefPickTitle} numberOfLines={1}>{recipe.title}</Text>
    </View>
    <View style={styles.recipeMeta}>
      <Ionicons name="star" size={11} color="#FFB800" />
      <Text style={styles.recipeMetaStat}>{(recipe.reviewAvgRating ?? 0).toFixed(1)}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Ionicons name="heart" size={11} color="#FF6B6B" />
      <Text style={styles.recipeMetaStat}>{recipe.likes ?? 0}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Image
        source={authorImage ? { uri: authorImage } : defaultAvatarAsset}
        style={styles.recipeAuthorInlineAvatar}
        contentFit="cover"
      />
      <Text style={[styles.recipeMetaStat, { flexShrink: 1 }]} numberOfLines={1}>{recipe.author}</Text>
    </View>
    <View style={styles.recipeMeta}>
      <Text style={[styles.recipeMetaStat, { color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{recipe.difficulty}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Ionicons name="time-outline" size={11} color="#BBB" />
      <Text style={styles.recipeMetaStat}>{recipe.time}분</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Text style={styles.recipeMetaStat}>{(recipe as any).calories ?? 0}kcal</Text>
    </View>
  </TouchableOpacity>
), (prev, next) => prev.recipe.id === next.recipe.id && prev.recipe.likes === next.recipe.likes && prev.recipe.reviewAvgRating === next.recipe.reviewAvgRating && prev.authorImage === next.authorImage);

const SmallRecipeCard = memo(({ recipe, subtitle, onPress, isLiked, onLike, authorImage, onAuthorPress }: {
  recipe: Recipe; subtitle: string; onPress: () => void; isLiked: boolean; onLike: () => void; authorImage?: string; onAuthorPress?: () => void;
}) => (
  <TouchableOpacity style={styles.recipeCard} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.recipeImageWrap}>
      <Image source={{ uri: hiResImage(recipe.image) }} style={styles.recipeImage} cachePolicy="disk" recyclingKey={`sm-${recipe.id}`} contentFit="cover" priority="high" />
      <TouchableOpacity style={[styles.recipeBookmark, isLiked && styles.recipeBookmarkActive]} onPress={onLike} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16} color={isLiked ? '#FF4D67' : '#fff'} />
      </TouchableOpacity>
    </View>
    <View style={styles.recipeNameRow}>
      <Text style={styles.recipeName} numberOfLines={1}>{recipe.title}</Text>
    </View>
    <View style={styles.recipeMeta}>
      <Ionicons name="star" size={11} color="#FFB800" />
      <Text style={styles.recipeMetaStat}>{(recipe.reviewAvgRating ?? 0).toFixed(1)}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Ionicons name="heart" size={11} color="#FF6B6B" />
      <Text style={styles.recipeMetaStat}>{recipe.likes ?? 0}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Image
        source={authorImage ? { uri: authorImage } : defaultAvatarAsset}
        style={styles.recipeAuthorInlineAvatar}
        contentFit="cover"
      />
      <Text style={[styles.recipeMetaStat, { flexShrink: 1 }]} numberOfLines={1}>{recipe.author}</Text>
    </View>
    <View style={styles.recipeMeta}>
      <Text style={[styles.recipeMetaStat, { color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{recipe.difficulty}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Ionicons name="time-outline" size={11} color="#BBB" />
      <Text style={styles.recipeMetaStat}>{recipe.time}분</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Text style={styles.recipeMetaStat}>{(recipe as any).calories ?? 0}kcal</Text>
    </View>
  </TouchableOpacity>
), (prev, next) => prev.recipe.id === next.recipe.id && prev.isLiked === next.isLiked && prev.recipe.likes === next.recipe.likes && prev.authorImage === next.authorImage);

const WeeklyRecipeCard = memo(({ recipe, onPress, authorImage, isLiked, onLike, onAuthorPress }: { recipe: Recipe; onPress: () => void; authorImage?: string; isLiked?: boolean; onLike?: () => void; onAuthorPress?: () => void }) => (
  <TouchableOpacity style={styles.weeklyCard} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.weeklyImageWrap}>
      <Image source={{ uri: hiResImage(recipe.image) }} style={styles.weeklyImage} cachePolicy="disk" recyclingKey={`wk-${recipe.id}`} contentFit="cover" priority="high" />
      <TouchableOpacity style={[styles.recipeBookmark, isLiked && styles.recipeBookmarkActive]} onPress={onLike} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16} color={isLiked ? '#FF4D67' : '#fff'} />
      </TouchableOpacity>
    </View>
    <View style={styles.recipeNameRow}>
      <Text style={styles.weeklyTitle} numberOfLines={1}>{recipe.title}</Text>
    </View>
    <View style={styles.recipeMeta}>
      <Ionicons name="star" size={11} color="#FFB800" />
      <Text style={styles.recipeMetaStat}>{(recipe.reviewAvgRating ?? 0).toFixed(1)}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Ionicons name="heart" size={11} color="#FF6B6B" />
      <Text style={styles.recipeMetaStat}>{recipe.likes ?? 0}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Image
        source={authorImage ? { uri: authorImage } : defaultAvatarAsset}
        style={styles.recipeAuthorInlineAvatar}
        contentFit="cover"
      />
      <Text style={[styles.recipeMetaStat, { flexShrink: 1 }]} numberOfLines={1}>{recipe.author}</Text>
    </View>
    <View style={styles.recipeMeta}>
      <Text style={[styles.recipeMetaStat, { color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }]}>{recipe.difficulty}</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Ionicons name="time-outline" size={11} color="#BBB" />
      <Text style={styles.recipeMetaStat}>{recipe.time}분</Text>
      <Text style={styles.recipeMetaDot}>·</Text>
      <Text style={styles.recipeMetaStat}>{(recipe as any).calories ?? 0}kcal</Text>
    </View>
  </TouchableOpacity>
), (prev, next) => prev.recipe.id === next.recipe.id && prev.isLiked === next.isLiked && prev.recipe.likes === next.recipe.likes && prev.authorImage === next.authorImage);

// AI 추천 카드용 — 예시 쿼리 순환 (3.5초마다 페이드 전환). 티저 텍스트로만 노출.
const AI_EXAMPLES = [
  '비 오는 날 매콤한 국물',
  '냉장고 양파 계란 김치',
  '30분 다이어트 메뉴',
  '술안주 추천',
  '아이도 좋아하는 요리',
  '해장에 좋은 거',
];

// AI 추천 진입 카드 — 입력 필드 X, 카드 전체를 탭하면 /ai-recommend 로 이동.
// 입력은 ai-recommend 화면에서 일관되게 처리.
const AiRecommendCard = memo(({ onPress }: { onPress: () => void }) => {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
        setIdx(p => (p + 1) % AI_EXAMPLES.length);
        Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      });
    }, 3500);
    return () => clearInterval(id);
  }, [fade]);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <LinearGradient
        colors={AI_GRADIENT}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.aiRecommendBorder}
      >
        <View style={styles.aiRecommendCard}>
          <View style={styles.aiRecommendIconWrap}>
            <Ionicons name="sparkles" size={16} color="#9168C0" />
          </View>
          <Animated.Text
            style={[styles.aiRecommendTeaser, { opacity: fade }]}
            numberOfLines={1}
          >
            예: {AI_EXAMPLES[idx]}
          </Animated.Text>
          <LinearGradient
            colors={AI_GRADIENT}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.aiRecommendSubmit}
          >
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// Isolated animated placeholder – state changes here do NOT re-render HomeScreen
const AnimatedPlaceholder = memo(() => {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setIndex(prev => (prev + 1) % placeholderTexts.length);
        Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      });
    }, 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.Text
      style={[styles.animatedPlaceholder, { opacity: fade }]}
      pointerEvents="none"
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {`${placeholderTexts[index]}${josaEulReul(placeholderTexts[index])} 검색해보세요`}
    </Animated.Text>
  );
});

// Season helper
const SEASON_CATEGORIES: Record<number, { label: string; categories: string[] }> = {
  1: { label: '겨울 따뜻한 요리', categories: ['저녁'] },
  2: { label: '겨울 따뜻한 요리', categories: ['저녁'] },
  3: { label: '봄맞이 가벼운 요리', categories: ['점심', '간식'] },
  4: { label: '봄맞이 가벼운 요리', categories: ['점심', '간식'] },
  5: { label: '초여름 상큼한 요리', categories: ['음료', '간식'] },
  6: { label: '여름 시원한 요리', categories: ['음료', '간식'] },
  7: { label: '여름 시원한 요리', categories: ['음료', '간식'] },
  8: { label: '여름 시원한 요리', categories: ['음료', '간식'] },
  9: { label: '가을 든든한 요리', categories: ['저녁', '점심'] },
  10: { label: '가을 든든한 요리', categories: ['저녁', '점심'] },
  11: { label: '겨울 따뜻한 요리', categories: ['저녁'] },
  12: { label: '겨울 따뜻한 요리', categories: ['저녁'] },
};

// Section types for the single FlatList
type SectionItem =
  | { type: 'header' }
  | { type: 'todayPick'; data: Recipe }
  | { type: 'best'; data: Recipe[] }
  | { type: 'recommended'; data: Recipe[] }
  | { type: 'chefPick'; data: Recipe[] }
  | { type: 'quick'; data: Recipe[] }
  | { type: 'season'; data: Recipe[]; label: string }
  | { type: 'snack'; data: Recipe[] }
  | { type: 'weekly'; data: Recipe[] }
  | { type: 'banner' };

export default function HomeScreen() {
  mark('home:render-start');
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const homeListRef = useRef<FlatList<any>>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const recipeHref = (r: Recipe) =>
    (r as any).__isCommunity ? `/recipe/${r.id}?type=community` : `/recipe/${r.id}`;
  const [urgentFridge, setUrgentFridge] = useState<FridgeItem[]>([]);
  const [fridgeStorageFilter, setFridgeStorageFilter] = useState<'fridge' | 'freezer'>('fridge');
  const visibleFridge = React.useMemo(
    () => urgentFridge.filter(item => resolveStorage(item) === fridgeStorageFilter),
    [urgentFridge, fridgeStorageFilter]
  );
  const fridgeFlipAnim = useRef(new Animated.Value(0)).current;
  const [fridgePillScrolled, setFridgePillScrolled] = useState(false);
  // 필터 전환 시 스크롤 상태 리셋 → chevron 및 애니메이션 재노출
  useEffect(() => { setFridgePillScrolled(false); }, [fridgeStorageFilter]);
  const chevronNudgeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(chevronNudgeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(chevronNudgeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.delay(700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [chevronNudgeAnim]);
  const handleToggleStorage = useCallback(() => {
    Animated.timing(fridgeFlipAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setFridgeStorageFilter(prev => (prev === 'fridge' ? 'freezer' : 'fridge'));
      Animated.timing(fridgeFlipAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }, [fridgeFlipAnim]);
  const [fridgeSettings, setFridgeSettings] = useState<FridgeSettings>(DEFAULT_SETTINGS);
  const [challenges, setChallenges] = useState<ChallengeToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const likePendingRef = useRef<Set<string>>(new Set());
  // 홈 reloadAll throttle — 30초 이내 재진입은 재요청 스킵 (체감 렉 제거).
  // 명시적 새로고침(로고 탭) 또는 변동 가능성 있는 액션 후엔 0으로 리셋해 강제 fetch.
  const lastFetchRef = useRef(0);
  const RELOAD_THROTTLE_MS = 30_000;
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [authorImages, setAuthorImages] = useState<Record<string, string>>({});
  const [authorUids, setAuthorUids] = useState<Record<string, string>>({});
  const [topUsers, setTopUsers] = useState<UserProfile[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [attendanceToast, setAttendanceToast] = useState<{
    visible: boolean;
    streak: number;
    earnedPoints: number;
    bonusPoints?: number;
  }>({ visible: false, streak: 0, earnedPoints: 0 });
  const [welcomeToast, setWelcomeToast] = useState<{ visible: boolean; earnedPoints: number }>({
    visible: false,
    earnedPoints: 0,
  });

  // 가입 직후 홈 진입 시 환영 토스트 표시 (한 번만).
  // 첫 페인트 후로 미뤄 메인 스레드 부담 분산 — 토스트는 즉시 표시 안 돼도 UX 영향 없음.
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const uid = firebaseUser.uid;
    const handle = InteractionManager.runAfterInteractions(async () => {
      try {
        const key = `welcome:pending:${uid}`;
        const pending = await AsyncStorage.getItem(key);
        if (!pending) return;
        await AsyncStorage.removeItem(key);
        const amount = parseInt(pending, 10) || 500;
        setWelcomeToast({ visible: true, earnedPoints: amount });
      } catch {}
    });
    return () => handle.cancel();
  }, [firebaseUser?.uid]);

  // 오늘의 도전과제 로드.
  // 예전엔 여기서 홈 진입만으로 출석 포인트를 지급했지만, 아무 행동도 유도하지
  // 못하면서 원가만 늘어서 폐지했다. 이제 연속은 과제를 완료해야 이어진다.
  // 첫 페인트 후로 미뤄 콜드 스타트 첫 화면 즉시성 확보.
  const loadChallenges = useCallback(async () => {
    const uid = firebaseUser?.uid;
    if (!uid) { setChallenges(null); return; }
    try {
      setChallenges(await fetchTodayChallenges(uid));
    } catch (e: any) {
      console.warn('도전과제 로드 실패:', e?.message);
    }
  }, [firebaseUser?.uid]);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(loadChallenges);
    return () => handle.cancel();
  }, [loadChallenges]);

  // 과제를 완료하고 홈으로 돌아왔을 때 띠를 최신화
  useFocusEffect(
    useCallback(() => { loadChallenges(); }, [loadChallenges])
  );

  const reloadAll = useCallback(async (force = false) => {
    // 30초 throttle — 다른 탭→홈 빠른 재진입에서 376KB 재다운로드 + 거대 리렌더 방지.
    // 첫 진입(lastFetchRef=0)은 항상 통과. force=true(로고 탭)는 제한 무시.
    const now = Date.now();
    if (!force && lastFetchRef.current > 0 && now - lastFetchRef.current < RELOAD_THROTTLE_MS) {
      return;
    }
    lastFetchRef.current = now;
    mark('home:reloadAll:start');
    try {
      const uid = firebaseUser?.uid;
      const [r, cr, fresh, users] = await Promise.all([
        timed('fetchRecipes', fetchRecipes()),
        timed('fetchCommunityRecipes', fetchCommunityRecipes()),
        uid ? timed('fetchUser', fetchUser(uid)) : Promise.resolve(null),
        timed('fetchTopUsers(30)', fetchTopUsers(30)),
      ]);
      mark('home:reloadAll:all-resolved');
      const blockedUids = ((fresh as any)?.blockedUids ?? []) as string[];
      const filteredCr = cr.filter(cc => !cc.authorUid || !blockedUids.includes(cc.authorUid));
      const merged: Recipe[] = [...r, ...filteredCr.map(cc => ({ ...cc, rating: 0, __isCommunity: true } as unknown as Recipe))];
      setRecipes(merged);
      if (fresh) setLikedIds(new Set(fresh.likedRecipes ?? []));
      // 냉장고 재료 — 유효기간 가까운 순으로 정렬 + 유저 설정 로드
      try {
        const [fridgeList, settings] = await Promise.all([getFridge(), loadFridgeSettings()]);
        const sorted = [...fridgeList].sort(
          (a, b) => daysUntilExpiry(a.expiresAt) - daysUntilExpiry(b.expiresAt)
        );
        setUrgentFridge(sorted);
        setFridgeSettings(settings);
      } catch {}
      const map: Record<string, string> = {};
      const uidMap: Record<string, string> = {};
      for (const u of users) {
        if (u.nickname) {
          uidMap[u.nickname] = u.uid;
          if (isRemoteProfileImage(u.profileImage)) {
            map[u.nickname] = u.profileImage;
          }
        }
      }
      setAuthorImages(map);
      setAuthorUids(uidMap);
      setTopUsers(users);
      // 안 읽은 알림 수
      if (uid) {
        const nickname = fresh?.nickname || '';
        getUnreadCount(uid, nickname).then(setUnreadCount).catch(() => {});
      }
    } catch (e) {
      console.warn('API 로드 실패:', e);
    } finally {
      setLoading(false);
      mark('home:reloadAll:end');
    }
  }, [firebaseUser?.uid]);

  useFocusEffect(
    useCallback(() => {
      reloadAll(false);
    }, [reloadAll])
  );

  const handleLogoPress = useCallback(() => {
    homeListRef.current?.scrollToOffset({ offset: 0, animated: true });
    reloadAll(true);
  }, [reloadAll]);

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
    if (!isLiked) {
      setToastMessage('좋아요 했어요.');
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 3000);
    }
    try {
      if (isLiked) {
        await unlikeRecipeUser(uid, recipeId);
      } else {
        await likeRecipeUser(uid, recipeId);
        // 좋아요 과제 — 취소는 완료로 치지 않는다
        completeChallenge(uid, 'like').then(r => { if (r) setChallenges(r); });
      }
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        isLiked ? next.add(recipeId) : next.delete(recipeId);
        return next;
      });
      setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, likes: (r.likes || 0) + (isLiked ? 1 : -1) } : r));
    } finally {
      likePendingRef.current.delete(recipeId);
    }
  }, [firebaseUser?.uid]);

  const seededShuffle = useCallback((arr: Recipe[], seed: number) => {
    const copy = [...arr];
    let s = seed;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }, []);

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    // 매 5분마다 체크해서 날짜가 바뀌면 re-render 트리거
    const interval = setInterval(() => setNowTick(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const now = new Date(nowTick);
  const daySeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const weekSeed = now.getFullYear() * 100 + Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

  const recommendedRecipes = useMemo(() => timeSync('memo:recommendedRecipes', () => seededShuffle(recipes, daySeed).slice(0, 6)), [recipes, daySeed]);
  const quickRecipes = useMemo(() => timeSync('memo:quickRecipes', () => [...recipes].filter(r => r.time <= 15).sort((a, b) => a.time - b.time).slice(0, 6)), [recipes]);
  const weeklyRecipes = useMemo(() => timeSync('memo:weeklyRecipes', () => seededShuffle(recipes, weekSeed).slice(0, 6)), [recipes, weekSeed]);
  const bestRecipes = useMemo(() => timeSync('memo:bestRecipes', () => [...recipes].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10)), [recipes]);
  const snackRecipes = useMemo(() => timeSync('memo:snackRecipes', () => recipes.filter(r => r.category === '간식' || r.category === '디저트').slice(0, 6)), [recipes]);
  const todayPick = useMemo(() => timeSync('memo:todayPick', () => seededShuffle(recipes, daySeed + 999)[0]), [recipes, daySeed]);
  const seasonInfo = SEASON_CATEGORIES[now.getMonth() + 1];
  const seasonRecipes = useMemo(() => timeSync('memo:seasonRecipes', () => recipes.filter(r => seasonInfo.categories.includes(r.category)).slice(0, 6)), [recipes, seasonInfo]);
  const chefPickRecipes = useMemo(() => timeSync('memo:chefPickRecipes', () => {
    const TARGET = 4;
    if (!recipes.length || !topUsers.length) return [] as Recipe[];

    // 팔로워 수 내림차순, 동률이면 닉네임 가나다순
    const sortedUsers = [...topUsers].sort((a, b) => {
      const fa = a.followers?.length ?? 0;
      const fb = b.followers?.length ?? 0;
      if (fb !== fa) return fb - fa;
      return (a.nickname || '').localeCompare(b.nickname || '', 'ko');
    });

    // 각 셰프의 좋아요 내림차순 레시피 리스트 준비
    const ownRecipesByNickname = new Map<string, Recipe[]>();
    for (const u of sortedUsers) {
      if (!u.nickname) continue;
      const own = recipes
        .filter(r => r.author === u.nickname)
        .sort((a, b) => (b.likes || 0) - (a.likes || 0));
      if (own.length) ownRecipesByNickname.set(u.nickname, own);
    }

    // 레시피를 가진 셰프만 순서대로
    const chefsWithRecipes = sortedUsers.filter(
      u => u.nickname && ownRecipesByNickname.has(u.nickname)
    );

    if (chefsWithRecipes.length >= TARGET) {
      // 4명 이상 확보: 각 셰프 1인 1레시피 (가장 좋아요 많은 것)
      return chefsWithRecipes.slice(0, TARGET).map(u => ownRecipesByNickname.get(u.nickname!)![0]);
    }
    if (chefsWithRecipes.length > 0) {
      // 셰프 부족: 최상위 셰프 1명의 좋아요 순 레시피로 4개 채움
      const top = chefsWithRecipes[0];
      return (ownRecipesByNickname.get(top.nickname!) ?? []).slice(0, TARGET);
    }
    return [] as Recipe[];
  }), [recipes, topUsers]);

  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const categoryIconSize = Math.min(68, (screenWidth - 24) / 5 - 4);

  // Build section data for single FlatList
  const sections = useMemo<SectionItem[]>(() => timeSync('memo:sections', () => {
    const items: SectionItem[] = [
      { type: 'header' },
      { type: 'best', data: bestRecipes },
    ];
    items.push({ type: 'recommended', data: recommendedRecipes });
    if (chefPickRecipes.length > 0) items.push({ type: 'chefPick', data: chefPickRecipes });
    items.push({ type: 'quick', data: quickRecipes });
    items.push({ type: 'snack', data: snackRecipes });
    items.push({ type: 'weekly', data: weeklyRecipes });
    return items;
  }), [bestRecipes, todayPick, recommendedRecipes, chefPickRecipes, quickRecipes, seasonRecipes, snackRecipes, weeklyRecipes]);

  // 첫 sections 빌드 후 한 번만 마크 (recipes 데이터가 들어와서 진짜 콘텐츠 sections 가 만들어진 시점)
  const sectionsMarkedRef = useRef(false);
  useEffect(() => {
    if (!sectionsMarkedRef.current && recipes.length > 0) {
      sectionsMarkedRef.current = true;
      mark('home:first-content-sections-built');
    }
  }, [recipes.length]);

  // 데이터 도착 즉시 visible 카드 이미지 prefetch — 콜드 스타트에서 디스크 캐시 미스를
  // 백그라운드에서 미리 채워 화면 진입 시 네트워크 대기 없이 표시되도록.
  // expo-image 가 캐시에 적재만 하고 렌더는 안 함 (fire-and-forget). 한 번만 실행.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (prefetchedRef.current || recipes.length === 0) return;
    prefetchedRef.current = true;
    const urls = new Set<string>();
    for (const list of [bestRecipes, recommendedRecipes, quickRecipes, snackRecipes, weeklyRecipes, chefPickRecipes, seasonRecipes]) {
      for (const r of list) {
        if (r?.image) urls.add(hiResImage(r.image));
      }
    }
    if (urls.size > 0) {
      try { Image.prefetch(Array.from(urls), 'disk'); } catch {}
    }
  }, [recipes.length, bestRecipes, recommendedRecipes, quickRecipes, snackRecipes, weeklyRecipes, chefPickRecipes, seasonRecipes]);

  const renderSection = useCallback(({ item }: { item: SectionItem }) => {
    if (item.type === 'header') {
      return (
        <>
          {/* 오늘의 도전 띠 — 검색창 바로 아래. 로그인 상태에서만. 본체는 /challenges */}
          <DailyChallengeBar
            data={challenges}
            onPress={() => router.push('/challenges' as any)}
          />

          {/* 배너 슬라이더 */}
          <StackAdCard router={router} />
          {/* Categories */}
          <View style={styles.categoriesContainer}>
            {HOME_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.categoryItem} onPress={() => router.push({ pathname: '/(tabs)/recipe', params: { category: cat.name, _t: String(Date.now()) } })}>
                <View style={[styles.categoryIcon, { width: categoryIconSize, height: categoryIconSize, borderRadius: categoryIconSize * 0.3 }]}>
                  {categoryIcons[cat.name] ? (
                    <Image source={categoryIcons[cat.name]} style={{ width: categoryIconSize, height: categoryIconSize, borderRadius: categoryIconSize * 0.3 } as any} contentFit="cover" />
                  ) : (
                    <Text style={[styles.categoryEmoji, { fontSize: categoryIconSize * 0.4 }]}>{cat.icon}</Text>
                  )}
                </View>
                <Text style={styles.categoryText}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* AI 추천 진입 카드 — 탭하면 AI 셰프 화면으로 이동, 입력은 거기서 처리 */}
          <AiRecommendCard onPress={() => router.push('/ai-recommend' as any)} />

          {/* 내 냉장고 배너 — 냉장고 모양 컨테이너 */}
          {urgentFridge.length === 0 ? (
            <LinearGradient
              colors={['#D9F1E3', '#B8DFCC']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.fridgeGradientBorder}
            >
            <TouchableOpacity
              style={styles.fridgeEmptyCard}
              activeOpacity={0.85}
              onPress={() => router.push('/my-fridge' as any)}
            >
              <LinearGradient
                colors={['#FFFFFF', '#EAF7EF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fridgeEmptyGradient}
              >
                <View style={styles.fridgeEmptyContent}>
                  <Text style={styles.fridgeEmptyTitle}>
                    냉장고가 비어있어요{'\n'}재료 추가하러 가기
                  </Text>
                  <View style={styles.fridgeEmptySphereWrap}>
                    <View style={styles.fridgeEmptySphere}>
                      <LinearGradient
                        colors={['#8DE8B3', '#14B86F', '#0A7A4F']}
                        start={{ x: 0.2, y: 0.15 }}
                        end={{ x: 0.85, y: 0.95 }}
                        style={styles.fridgeEmptySphereGrad}
                      />
                      <View style={styles.fridgeEmptySphereHighlight} />
                      <Ionicons name="leaf" size={26} color="#FFFFFF" />
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#B5C2CC"
                    style={styles.fridgeEmptyChevron}
                  />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={['#D9F1E3', '#B8DFCC']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.fridgeGradientBorder}
            >
            <View style={styles.aiBanner}>
              <LinearGradient
                colors={['#FFFFFF', '#FFFFFF', '#D0ECD9']}
                locations={[0, 0.6, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.aiBannerGradient}
                pointerEvents="none"
              />
              <View style={styles.fridgeUrgentOverlay} pointerEvents="box-none">
                <Animated.View
                  style={[
                    styles.fridgePillRow,
                    {
                      transform: [
                        {
                          rotateX: fridgeFlipAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '-90deg'],
                          }),
                        },
                        {
                          translateY: fridgeFlipAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -8],
                          }),
                        },
                      ],
                      opacity: fridgeFlipAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                    },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: fridgeScaled(4) }}
                    onScroll={(e) => setFridgePillScrolled(e.nativeEvent.contentOffset.x > 4)}
                    scrollEventThrottle={16}
                    nestedScrollEnabled
                    directionalLockEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {visibleFridge.length === 0 ? (
                      <TouchableOpacity
                        style={styles.fridgeStorageEmpty}
                        onPress={() => router.push('/my-fridge' as any)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.fridgeStorageEmptyText}>
                          {fridgeStorageFilter === 'fridge' ? '냉장실에 재료가 없어요' : '냉동실에 재료가 없어요'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      visibleFridge.map(item => {
                        const days = daysUntilExpiry(item.expiresAt);
                        const status = getExpiryStatusWith(item.expiresAt, fridgeSettings.urgentDays, fridgeSettings.soonDays);
                        const label =
                          days < 0 ? `${Math.abs(days)}일 지남`
                          : days === 0 ? '오늘까지'
                          : days === 1 ? '내일까지'
                          : `${days}일 남음`;
                        const color =
                          status === 'expired' ? fridgeSettings.colors.expired
                          : status === 'urgent' ? fridgeSettings.colors.urgent
                          : status === 'soon' ? fridgeSettings.colors.soon
                          : fridgeSettings.colors.ok;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.fridgePill}
                            onPress={() => router.push('/my-fridge' as any)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.fridgePillThumb}>
                              {item.imageUrl ? (
                                <Image source={{ uri: item.imageUrl }} style={styles.fridgePillImg} contentFit="cover" />
                              ) : (
                                <Text style={styles.fridgePillEmoji}>{item.icon}</Text>
                              )}
                            </View>
                            <Text style={styles.fridgePillName} numberOfLines={1}>{item.name}</Text>
                            <Text style={[styles.fridgePillDays, { color }]} numberOfLines={1}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                  {!fridgePillScrolled && visibleFridge.length > MAX_FRIDGE_PILLS && (
                    <Animated.View
                      style={[
                        styles.fridgePillMore,
                        {
                          transform: [{
                            translateX: chevronNudgeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, fridgeScaled(5)],
                            }),
                          }],
                          opacity: chevronNudgeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.55, 1],
                          }),
                        },
                      ]}
                    >
                      <Ionicons name="chevron-forward" size={fridgeScaled(18)} color="#1A1A1A" />
                    </Animated.View>
                  )}
                  <TouchableOpacity
                    style={styles.fridgeStorageColumn}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleToggleStorage();
                    }}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.fridgeStorageLabel}>
                      {fridgeStorageFilter === 'fridge' ? '냉장실' : '냉동실'}
                    </Text>
                    <View style={styles.fridgeStorageToggle}>
                      <Ionicons name="swap-vertical" size={fridgeScaled(14)} color="#1A1A1A" />
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
            </LinearGradient>
          )}
        </>
      );
    }

    if (item.type === 'todayPick') {
      const recipe = item.data;
      return (
        <TouchableOpacity style={styles.todayBanner} activeOpacity={0.85} onPress={() => router.push(recipeHref(recipe) as any)}>
          <Image source={{ uri: hiResImage(recipe.image) }} style={styles.todayBannerImage} cachePolicy="disk" contentFit="cover" />
          <View style={styles.todayBannerOverlay}>
            <View style={styles.todayBannerTextWrap}>
              <Text style={styles.todayBannerSub}>오늘의 추천 레시피</Text>
              <Text style={styles.todayBannerTitle} numberOfLines={1}>{recipe.title}</Text>
              <Text style={styles.todayBannerDesc}>{recipe.time}분 · <Text style={{ color: recipe.difficulty === '쉬움' ? '#1BAE74' : recipe.difficulty === '어려움' ? '#E74C3C' : '#F5A623', fontWeight: '700' }}>{recipe.difficulty}</Text></Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item.type === 'best') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>베스트 레시피</Text>
          </View>
          <FlatList
            horizontal
            data={item.data}
            keyExtractor={(r) => r.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bestListHorizontal}
            removeClippedSubviews
            initialNumToRender={3}
            maxToRenderPerBatch={2}
            windowSize={3}
            renderItem={({ item: recipe, index: idx }) => (
              <BestRecipeCard recipe={recipe} idx={idx} onPress={() => router.push(recipeHref(recipe) as any)} authorImage={authorImages[recipe.author]} onAuthorPress={() => authorUids[recipe.author] && router.push(`/profile/${authorUids[recipe.author]}`)} />
            )}
          />
        </>
      );
    }

    if (item.type === 'banner') {
      return null;
    }

    if (item.type === 'recommended') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>추천 레시피</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal} removeClippedSubviews>
            {item.data.map((recipe) => (
              <SmallRecipeCard key={recipe.id} recipe={recipe} subtitle={`By ${recipe.author}`} onPress={() => router.push(recipeHref(recipe) as any)} isLiked={likedIds.has(recipe.id)} onLike={() => toggleLike(recipe.id)} authorImage={authorImages[recipe.author]} onAuthorPress={() => authorUids[recipe.author] && router.push(`/profile/${authorUids[recipe.author]}`)} />
            ))}
          </ScrollView>
        </>
      );
    }

    if (item.type === 'chefPick') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>인기 셰프 레시피</Text>
          </View>
          <View style={styles.chefPickGrid}>
            {item.data.slice(0, 4).map((recipe) => (
              <ChefPickCard
                key={recipe.id}
                recipe={recipe}
                onPress={() => router.push(recipeHref(recipe) as any)}
                authorImage={authorImages[recipe.author]}
              />
            ))}
          </View>
        </>
      );
    }

    if (item.type === 'quick') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>초스피드 요리</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal} removeClippedSubviews>
            {item.data.map((recipe) => (
              <SmallRecipeCard key={recipe.id} recipe={recipe} subtitle={`${recipe.time}분 · ${recipe.difficulty}`} onPress={() => router.push(recipeHref(recipe) as any)} isLiked={likedIds.has(recipe.id)} onLike={() => toggleLike(recipe.id)} authorImage={authorImages[recipe.author]} onAuthorPress={() => authorUids[recipe.author] && router.push(`/profile/${authorUids[recipe.author]}`)} />
            ))}
          </ScrollView>
        </>
      );
    }

    if (item.type === 'season') {
      return (
        <>
          <View style={styles.seasonBanner}>
            <Text style={styles.seasonEmoji}>🍃</Text>
            <View>
              <Text style={styles.seasonTitle}>{item.label}</Text>
              <Text style={styles.seasonSub}>지금 이 계절에 딱 맞는 레시피</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal} removeClippedSubviews>
            {item.data.map((recipe) => (
              <SmallRecipeCard key={recipe.id} recipe={recipe} subtitle={`${recipe.time}분 · ${recipe.difficulty}`} onPress={() => router.push(recipeHref(recipe) as any)} isLiked={likedIds.has(recipe.id)} onLike={() => toggleLike(recipe.id)} authorImage={authorImages[recipe.author]} onAuthorPress={() => authorUids[recipe.author] && router.push(`/profile/${authorUids[recipe.author]}`)} />
            ))}
          </ScrollView>
        </>
      );
    }

    if (item.type === 'snack') {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>인기 간식</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipeListHorizontal} removeClippedSubviews>
            {item.data.map((recipe) => (
              <SmallRecipeCard key={recipe.id} recipe={recipe} subtitle={`By ${recipe.author}`} onPress={() => router.push(recipeHref(recipe) as any)} isLiked={likedIds.has(recipe.id)} onLike={() => toggleLike(recipe.id)} authorImage={authorImages[recipe.author]} onAuthorPress={() => authorUids[recipe.author] && router.push(`/profile/${authorUids[recipe.author]}`)} />
            ))}
          </ScrollView>
        </>
      );
    }

    // weekly
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>이번 주 레시피</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weeklyContainer} removeClippedSubviews>
          {item.data.map((recipe) => (
            <WeeklyRecipeCard key={recipe.id} recipe={recipe} onPress={() => router.push(recipeHref(recipe) as any)} authorImage={authorImages[recipe.author]} isLiked={likedIds.has(recipe.id)} onLike={() => toggleLike(recipe.id)} onAuthorPress={() => authorUids[recipe.author] && router.push(`/profile/${authorUids[recipe.author]}`)} />
          ))}
        </ScrollView>
      </>
    );
  }, [search, categoryIconSize, router, likedIds, toggleLike, authorImages, authorUids, urgentFridge, visibleFridge, fridgeStorageFilter, fridgeSettings, fridgeFlipAnim, handleToggleStorage, challenges]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AttendanceToast
        visible={attendanceToast.visible}
        streak={attendanceToast.streak}
        earnedPoints={attendanceToast.earnedPoints}
        bonusPoints={attendanceToast.bonusPoints}
        onAutoDismiss={() => setAttendanceToast(prev => ({ ...prev, visible: false }))}
      />
      <WelcomeToast
        visible={welcomeToast.visible}
        earnedPoints={welcomeToast.earnedPoints}
        onAutoDismiss={() => setWelcomeToast(prev => ({ ...prev, visible: false }))}
      />
      {/* Fixed Header */}
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
          <TouchableOpacity style={styles.headerSearchBar} activeOpacity={0.7} onPress={() => router.push('/search')}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={11} cy={11} r={8} />
              <Line x1={21} y1={21} x2={16.65} y2={16.65} />
            </Svg>
            <View style={styles.headerSearchTextWrap}>
              <AnimatedPlaceholder />
            </View>
          </TouchableOpacity>
        </LinearGradient>
        <TouchableOpacity onPress={async () => {
          // 모두 읽음 처리 후 페이지 이동 — 배지 즉시 0으로 보정.
          if (firebaseUser?.uid) {
            try { await markAllNotificationsRead(firebaseUser.uid); } catch {}
          }
          setUnreadCount(0);
          router.push('/notifications');
        }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={22} color="#1A1A1A" />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <FlatList
        ref={homeListRef}
        data={sections}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderSection}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        // Android 보급형(A36 등)에서 화면 밖 섹션 40~70개 카드 상시 마운트 비용이 큼.
        // iOS는 view recycling이 효율적이라 false 유지해도 무방.
        removeClippedSubviews={Platform.OS === 'android'}
        // 플랫폼별 스크롤 성능 튜닝 — Android는 메인 스레드가 빠듯해서 한 번에 적게 렌더하고
        // 윈도우(예약 마운트 영역)도 좁힘. iOS는 기존 값 유지.
        initialNumToRender={Platform.OS === 'android' ? 2 : 4}
        maxToRenderPerBatch={Platform.OS === 'android' ? 1 : 3}
        windowSize={Platform.OS === 'android' ? 3 : 7}
        updateCellsBatchingPeriod={Platform.OS === 'android' ? 100 : 50}
      />
      {toastVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
          <TouchableOpacity style={styles.toastBtnWrap} onPress={() => { setToastVisible(false); router.push(`/(tabs)/profile?tab=saved&_t=${Date.now()}`); }}>
            <Text style={styles.toastBtn}>좋아요 보기</Text>
          </TouchableOpacity>
        </View>
      )}
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
    height: 56,
    marginTop: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerLogo: {
    fontSize: 30,
    fontFamily: 'KimKongHae',
    color: '#000000',
    marginLeft: 6,
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
    gap: 8,
  },
  headerSearchTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  headerGreeting: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerAvatarFallback: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellWrap: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
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
    borderWidth: 1.5,
    borderColor: '#14B86F',
    shadowColor: '#14B86F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
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
    fontSize: 14,
    color: '#6B6B6B',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    flexShrink: 0,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 14,
    rowGap: 0,
  },
  // AI 추천 인라인 입력 — Gemini 스타일 그라데이션 보더
  aiRecommendBorder: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    padding: 1.5,
  },
  aiRecommendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 22.5,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  aiRecommendIconWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiRecommendTeaser: {
    flex: 1,
    fontSize: 14,
    color: '#9E9E9E',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  aiRecommendSubmit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeGradientBorder: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 19,
    padding: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  aiBanner: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    minHeight: 110,
    padding: 14,
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  aiBannerGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
  },
  fridgeEmptyCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  fridgeEmptyGradient: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  fridgeEmptyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 110,
    paddingLeft: 22,
    paddingRight: 12,
    paddingVertical: 14,
  },
  fridgeEmptyTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Pretendard-SemiBold',
    fontWeight: Platform.OS === 'ios' ? '700' : '600',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  fridgeEmptySphereWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    marginHorizontal: 6,
    shadowColor: '#0B9A61',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fridgeEmptySphere: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fridgeEmptySphereGrad: {
    ...StyleSheet.absoluteFillObject,
  },
  fridgeEmptySphereHighlight: {
    position: 'absolute',
    top: 7,
    left: 11,
    width: 22,
    height: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-20deg' }],
  },
  fridgeEmptyChevron: {
    marginLeft: 2,
  },
  fridgeUrgentOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  fridgePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: fridgeScaled(4),
    paddingHorizontal: fridgeScaled(10),
  },
  fridgePill: {
    alignItems: 'center',
    paddingVertical: fridgeScaled(7),
    paddingHorizontal: fridgeScaled(5),
    width: fridgeScaled(60),
  },
  fridgePillThumb: {
    width: fridgeScaled(32),
    height: fridgeScaled(32),
    borderRadius: fridgeScaled(9),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: fridgeScaled(3),
  },
  fridgePillImg: {
    width: '100%',
    height: '100%',
  },
  fridgePillEmoji: {
    fontSize: fridgeScaled(28),
    lineHeight: fridgeScaled(32),
    textAlign: 'center',
  },
  fridgePillName: {
    fontSize: fridgeScaled(9),
    lineHeight: fridgeScaled(12),
    fontWeight: '700',
    color: '#1A1A1A',
    maxWidth: fridgeScaled(52),
    includeFontPadding: false,
  },
  fridgePillDays: {
    fontSize: fridgeScaled(8),
    lineHeight: fridgeScaled(11),
    fontWeight: '700',
    marginTop: fridgeScaled(2),
    includeFontPadding: false,
  },
  fridgePillMore: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: fridgeScaled(6),
    paddingHorizontal: fridgeScaled(4),
  },
  fridgeStorageColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    paddingLeft: fridgeScaled(4),
  },
  fridgeStorageLabel: {
    fontSize: fridgeScaled(13),
    fontWeight: '700',
    color: '#1A1A1A',
    includeFontPadding: false,
  },
  fridgeStorageToggle: {
    width: fridgeScaled(24),
    height: fridgeScaled(20),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: fridgeScaled(2),
  },
  fridgeStorageEmpty: {
    flex: 1,
    paddingLeft: fridgeScaled(4),
    justifyContent: 'center',
  },
  fridgeStorageEmptyText: {
    fontSize: fridgeScaled(12),
    color: '#8E8E93',
    fontWeight: '500',
  },
  fridgePillMoreText: {
    fontSize: fridgeScaled(13),
    lineHeight: fridgeScaled(15),
    fontWeight: '800',
    color: '#0B9A61',
    includeFontPadding: false,
  },
  categoryItem: {
    width: '20%',
    alignItems: 'center',
  },
  categoryItemActive: {},
  categoryIcon: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
    overflow: 'hidden',
  },
  categoryIconActive: {
    backgroundColor: '#1A1A1A',
  },
  categoryEmoji: {
    fontSize: 30,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  categoryTextActive: {
    color: '#1A1A1A',
  },
  recipeListHorizontal: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  recipeCard: {
    width: 150,
    marginHorizontal: 6,
  },
  recipeImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  recipeBookmark: {
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
  recipeBookmarkActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  recipeAuthorOverlay: {
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
  recipeAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  recipeAuthorAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeAuthorText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#fff',
    maxWidth: 50,
  },
  recipeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  recipeName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
    flexShrink: 1,
  },
  recipeAuthorInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  recipeAuthorInlineAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  recipeAuthorInlineAvatarFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeAuthorInline: {
    fontSize: 11,
    color: '#999',
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    overflow: 'hidden',
  },
  recipeMetaStat: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
  },
  recipeMetaDot: {
    fontSize: 11,
    color: '#DCDCDC',
  },
  // Today Banner
  todayBanner: {
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
  },
  todayBannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  todayBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  todayBannerTextWrap: {},
  todayBannerSub: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  todayBannerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  todayBannerDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  // Chef Pick
  chefPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    marginBottom: 8,
    rowGap: 10,
  },
  chefPickCard: {
    width: '48.5%',
  } as any,
  chefPickImageWrap: {
    borderRadius: 8,
    overflow: 'hidden',
    aspectRatio: 4 / 5,
    backgroundColor: '#FFFFFF',
  },
  chefPickImage: {
    width: '100%',
    height: '100%',
  },
  chefPickTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
    flexShrink: 1,
  },
  chefPickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  chefPickMetaText: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
  },
  chefPickMetaDot: {
    fontSize: 11,
    color: '#DCDCDC',
  },
  chefPickAuthor: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chefPickAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  chefPickName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    maxWidth: 60,
  },

  // Season Banner
  seasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 14,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#F0FAF5',
  },
  seasonEmoji: {
    fontSize: 32,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  seasonSub: {
    fontSize: 12,
    color: '#888',
  },

  // Best Recipes
  bestListHorizontal: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  bestCard: {
    width: 190,
    height: 180,
    marginHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  bestImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bestGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },
  bestRankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestRankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
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
  bestAuthorOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  bestAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  bestAuthorAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestAuthorName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#fff',
    maxWidth: 50,
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
  bestInfoBox: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  bestInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  bestInfoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bestCategory: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 2,
  },
  bestTitle: {
    fontSize: 15,
    fontFamily: 'Pretendard-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bestTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  bestAuthorInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bestAuthorInlineAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  bestAuthorInlineAvatarFallback: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestAuthorInline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  bestMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    rowGap: 2,
  },
  bestRating: {
    fontSize: 12,
    color: '#FF4D67',
    fontWeight: '700',
  },
  bestTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  bestDifficulty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  weeklyContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  weeklyCard: {
    width: width * 0.42,
    marginHorizontal: 6,
  },
  weeklyImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  weeklyImage: {
    width: '100%',
    height: '100%',
  },
  weeklyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    lineHeight: 20,
    flexShrink: 1,
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
    elevation: 8,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
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
  fab: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1BAE74',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A1A1A',
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
  bannerCard: {
    width: width - 32,
    height: width * 0.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPageIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bannerPageText: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    gap: 8,
  },
  noticeBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  noticeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  headerBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    height: (width - 32) * 0.5,
  },
  stackContainer: {
    marginTop: 10,
    marginBottom: 14,
  },
  stackCard: {
    width: STACK_CARD_W,
    aspectRatio: 2 / 1,
    marginHorizontal: STACK_GAP,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  stackBgImage: {
    width: '100%',
    height: '100%',
  },
  stackIndicatorWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  stackIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  indicatorProgressTrack: {
    width: 80,
    height: 2,
    backgroundColor: '#E5E5E5',
    borderRadius: 1,
    overflow: 'hidden',
  },
  indicatorProgressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#999',
    borderRadius: 1,
  },
  indicatorText: {
    fontSize: 11,
    color: '#444',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  headerBannerImage: {
    width: width - 32,
    height: (width - 32) * 0.5,
  },
  headerBannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  bannerDots: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  bannerDotActive: {
    backgroundColor: '#FFFFFF',
    width: 16,
  },
});
