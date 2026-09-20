import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import {
  recommendRecipes,
  getAiQuota,
  QuotaExceededError,
  OffTopicError,
  type AiRecommendItem,
} from '../services/aiRecommend';

// Gemini-inspired gradient: blue → purple → pink
const AI_GRADIENT: readonly [string, string, string] = ['#4796E3', '#9168C0', '#D96570'];
const AI_GRADIENT_DISABLED: readonly [string, string, string] = ['#D5D5D5', '#BDBDBD', '#A8A8A8'];

type Suggestion = { icon: keyof typeof Ionicons.glyphMap; text: string; query: string };
const SUGGESTIONS: Suggestion[] = [
  { icon: 'rainy-outline', text: '비 오는 날\n매콤한 국물', query: '비 와서 매콤한 국물' },
  { icon: 'snow-outline', text: '냉장고 재료로\n만들기', query: '냉장고에 양파 계란 김치 있어' },
  { icon: 'timer-outline', text: '30분 안에\n다이어트', query: '30분 안에 만들 수 있는 다이어트 메뉴' },
  { icon: 'wine-outline', text: '간단한\n술안주', query: '집에서 만들기 좋은 술안주' },
  { icon: 'happy-outline', text: '아이가\n좋아하는', query: '아이도 잘 먹는 요리' },
  { icon: 'sunny-outline', text: '해장에\n좋은 거', query: '해장에 좋은 음식' },
];

// 점 3개 페이드 애니메이션 (AI thinking 중)
function ThinkingDots() {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, easing: Easing.ease, useNativeDriver: true }),
        ])
      );
    };
    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 200);
    const a3 = animateDot(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
      {[dot1, dot2, dot3].map((d, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3, marginHorizontal: 2,
            backgroundColor: '#9168C0', opacity: d,
          }}
        />
      ))}
    </View>
  );
}

// 그라데이션 글로우 오브 (히어로 비주얼) — size로 작은 기기 대응
function HeroOrb({ size = 120 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const coreSize = Math.round(size * 0.633); // 120→76 비율 유지
  const iconSize = Math.round(size * 0.267); // 120→32 비율 유지

  return (
    <View style={[styles.orbWrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.orbHalo,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pulse }] },
        ]}
      >
        <LinearGradient
          colors={AI_GRADIENT}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.orbHaloInner, { borderRadius: size / 2 }]}
        />
      </Animated.View>
      <LinearGradient
        colors={AI_GRADIENT}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={[styles.orbCore, { width: coreSize, height: coreSize, borderRadius: coreSize / 2 }]}
      >
        <Ionicons name="sparkles" size={iconSize} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}

export default function AiRecommendScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // isPremium은 AuthContext에서 가져와야 구매/복원 후 즉시 반영됨 (로컬 state는 stale 됨).
  // dailyLimit은 백엔드가 권위라 별도 fetch 유지.
  const { firebaseUser, isPremium: isPremiumFromAuth } = useAuth();
  const params = useLocalSearchParams<{ query?: string }>();
  const { height: screenHeight } = useWindowDimensions();

  // 기기별 hero 영역 스케일 — 16 Pro Max(932pt) 기준 1.0, 17 Pro(874pt) 등 작은 기기는 축소.
  // 카드 6개(3행 × 2열)가 입력바 위로 올라와 잘리지 않게 hero 영역만 줄임.
  const isCompact = screenHeight < 900;
  const orbSize = isCompact ? 92 : 120;
  const greetingFontSize = isCompact ? 24 : 28;
  const greetingLineHeight = isCompact ? 32 : 36;
  const heroPaddingTop = isCompact ? 8 : 20;
  const orbMarginTop = isCompact ? 4 : 10;
  const orbMarginBottom = isCompact ? 10 : 18;
  const greetingSubMarginBottom = isCompact ? 18 : 28;
  const [query, setQuery] = useState(typeof params.query === 'string' ? params.query : '');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AiRecommendItem[]>([]);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  // 로컬 isPremium 제거 — AuthContext의 isPremiumFromAuth로 대체. 단 quota 응답이
  // 더 신선한 백엔드 truth라면 그걸 우선 (race window 보호).
  const [quotaIsPremium, setQuotaIsPremium] = useState<boolean | null>(null);
  const isPremium = quotaIsPremium ?? isPremiumFromAuth;
  const [dailyLimit, setDailyLimit] = useState(3);
  const [hasSearched, setHasSearched] = useState(false);
  const [resetCountdown, setResetCountdown] = useState('');
  const inputRef = useRef<TextInput>(null);

  // AI 쿼터는 KST 자정에 리셋 (백엔드: AiRecommendService LocalDate.now(Asia/Seoul) 기준)
  // 1분마다 카운트다운 갱신
  useEffect(() => {
    const calc = () => {
      const KST_OFFSET = 9 * 60 * 60 * 1000;
      const ONE_DAY = 24 * 60 * 60 * 1000;
      const remaining = ONE_DAY - ((Date.now() + KST_OFFSET) % ONE_DAY);
      const h = Math.floor(remaining / (60 * 60 * 1000));
      const m = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      if (h > 0) setResetCountdown(`${h}시간 ${m}분 후`);
      else if (m > 0) setResetCountdown(`${m}분 후`);
      else setResetCountdown('곧');
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, []);

  // 화면 진입 시 현재 쿼터 조회 — 헤더 표시용 (카운터 증가 X)
  // isPremiumFromAuth가 바뀌면 quota도 새로 fetch — 구독 직후 일 한도 5→20 즉시 반영
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    getAiQuota(firebaseUser.uid)
      .then(q => {
        setRemainingQuota(q.remainingFreeQuota);
        setQuotaIsPremium(q.isPremium);
        setDailyLimit(q.dailyLimit);
      })
      .catch(() => {});
  }, [firebaseUser?.uid, isPremiumFromAuth]);

  const submit = useCallback(async (text?: string) => {
    const q = (text ?? query).trim();
    if (!q) {
      Alert.alert('알림', '추천받고 싶은 요리 분위기를 입력해주세요.');
      return;
    }
    if (!firebaseUser?.uid) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    Keyboard.dismiss();
    setSubmittedQuery(q);
    setQuery('');
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    try {
      const res = await recommendRecipes(firebaseUser.uid, q);
      setResults(res.recommendations);
      setRemainingQuota(res.remainingFreeQuota);
    } catch (e: any) {
      if (e instanceof QuotaExceededError) {
        Alert.alert(
          '오늘의 무료 한도 소진',
          e.message,
          [
            { text: '나중에', style: 'cancel' },
            { text: '프리미엄 보기', onPress: () => router.push('/premium') },
          ]
        );
      } else if (e instanceof OffTopicError) {
        // 검색 상태 롤백 — 음식 외 입력은 결과 화면 진입 X, 쿼터 차감 X
        setHasSearched(false);
        setSubmittedQuery('');
        Alert.alert('알림', e.message);
      } else {
        Alert.alert('오류', e.message || 'AI 추천 처리 중 오류');
      }
    } finally {
      setLoading(false);
    }
  }, [query, firebaseUser?.uid, router]);

  // 홈에서 query param으로 진입한 경우 자동 검색 실행 (한 번만)
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (typeof params.query === 'string' && params.query.trim() && firebaseUser?.uid) {
      autoRanRef.current = true;
      submit(params.query.trim());
    }
  }, [params.query, firebaseUser?.uid, submit]);

  const isInputDisabled = loading || !query.trim();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow} pointerEvents="none">
          <LinearGradient
            colors={AI_GRADIENT}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.headerSparkle}
          >
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">AI 셰프</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => !isPremium && router.push('/premium')}
            disabled={isPremium}
            activeOpacity={0.75}
            style={styles.quotaPillWrap}
          >
            {isPremium ? (
              <LinearGradient
                colors={AI_GRADIENT}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.quotaPillPremium}
              >
                <Ionicons name="flash" size={11} color="#FFFFFF" />
                <Text style={styles.quotaPillPremiumText}>
                  {remainingQuota ?? '-'}/{dailyLimit}
                </Text>
              </LinearGradient>
            ) : (
              <View style={[
                styles.quotaPillFree,
                remainingQuota === 0 && styles.quotaPillEmpty,
              ]}>
                <Ionicons
                  name="flash"
                  size={11}
                  color={remainingQuota === 0 ? '#D96570' : '#9168C0'}
                />
                <Text style={[
                  styles.quotaPillFreeText,
                  remainingQuota === 0 && styles.quotaPillEmptyText,
                ]}>
                  {remainingQuota ?? '-'}/{dailyLimit}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 쿼터 소진 배너 — 무료 유저가 5/5 다 쓴 경우만 표시. 리셋까지 남은 시간 안내. */}
          {!isPremium && remainingQuota === 0 && !!resetCountdown && (
            <View style={styles.quotaResetBanner}>
              <Ionicons name="time-outline" size={16} color="#9168C0" />
              <Text style={styles.quotaResetBannerText}>
                오늘 사용량을 모두 썼어요. <Text style={styles.quotaResetBannerStrong}>{resetCountdown}</Text> 리셋돼요
              </Text>
            </View>
          )}

          {/* 빈 상태: 히어로 + 추천 카드 */}
          {!hasSearched && (
            <View style={[styles.heroWrap, { paddingTop: heroPaddingTop }]}>
              <View style={{ marginTop: orbMarginTop, marginBottom: orbMarginBottom }}>
                <HeroOrb size={orbSize} />
              </View>
              <Text style={[styles.greeting, { fontSize: greetingFontSize, lineHeight: greetingLineHeight }]}>
                오늘은{'\n'}뭐 드실까요?
              </Text>
              <Text style={[styles.greetingSub, { marginBottom: greetingSubMarginBottom }]}>
                분위기, 재료, 시간 — 뭐든 편하게 말씀해주세요
              </Text>

              <View style={styles.suggestGrid}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.text}
                    style={styles.suggestCard}
                    onPress={() => submit(s.query)}
                    activeOpacity={0.75}
                  >
                    <LinearGradient
                      colors={['rgba(71,150,227,0.10)', 'rgba(145,104,192,0.10)', 'rgba(217,101,112,0.10)']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.suggestCardIconWrap}
                    >
                      <Ionicons name={s.icon} size={22} color="#9168C0" />
                    </LinearGradient>
                    <Text style={styles.suggestCardText}>{s.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 챗 영역: 질문 버블 + AI 응답 */}
          {hasSearched && (
            <View style={styles.chatWrap}>
              {/* 사용자 질문 — 우측 정렬 그라데이션 버블 */}
              <View style={styles.userBubbleRow}>
                <LinearGradient
                  colors={AI_GRADIENT}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.userBubble}
                >
                  <Text style={styles.userBubbleText}>{submittedQuery}</Text>
                </LinearGradient>
              </View>

              {/* AI 응답 — 좌측 아바타 + 메시지 */}
              <View style={styles.aiRow}>
                <LinearGradient
                  colors={AI_GRADIENT}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.aiAvatar}
                >
                  <Ionicons name="sparkles" size={14} color="#FFFFFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  {loading ? (
                    <View style={styles.thinkingBubble}>
                      <Text style={styles.thinkingText}>AI가 메뉴를 고르고 있어요</Text>
                      <ThinkingDots />
                    </View>
                  ) : results.length > 0 ? (
                    <Text style={styles.aiMessage}>이런 메뉴들이 잘 어울려요</Text>
                  ) : (
                    <Text style={styles.aiMessage}>적합한 메뉴를 찾지 못했어요. 다른 표현으로 다시 물어봐 주세요.</Text>
                  )}
                </View>
              </View>

              {/* 추천 결과 카드 */}
              {!loading && results.map((item) => (
                <TouchableOpacity
                  key={item.recipeId}
                  style={styles.recipeCard}
                  onPress={() => router.push(`/recipe/${item.recipeId}`)}
                  activeOpacity={0.85}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.recipeImage} cachePolicy="disk" contentFit="cover" />
                  ) : (
                    <View style={[styles.recipeImage, { backgroundColor: '#F5F5F5' }]} />
                  )}
                  <View style={styles.recipeBody}>
                    <View style={styles.recipeTopRow}>
                      <Text style={styles.recipeTitle} numberOfLines={1}>{item.title}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#BDBDBD" />
                    </View>
                    {item.category && (
                      <View style={styles.categoryPillWrap}>
                        <LinearGradient
                          colors={['rgba(71,150,227,0.12)', 'rgba(217,101,112,0.12)']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={styles.categoryPill}
                        >
                          <Text style={styles.categoryPillText}>{item.category}</Text>
                        </LinearGradient>
                      </View>
                    )}
                    <Text style={styles.recipeReason} numberOfLines={3}>{item.reason}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {remainingQuota !== null && !loading && (
                <Text style={styles.quotaText}>
                  오늘 남은 추천 {remainingQuota}회
                  {remainingQuota === 0 && !isPremium ? ' · 프리미엄 가입 시 일 20회' : ''}
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* 하단 고정 입력 바 */}
        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <LinearGradient
            colors={AI_GRADIENT}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.composerBorder}
          >
            <View style={styles.composerInner}>
              <Ionicons name="sparkles" size={16} color="#9168C0" style={{ marginRight: 8 }} />
              <TextInput
                ref={inputRef}
                style={styles.composerInput}
                placeholder="AI에게 물어보세요"
                placeholderTextColor="#BDBDBD"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => submit()}
                returnKeyType="search"
                maxLength={100}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => submit()}
                disabled={isInputDisabled}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={isInputDisabled ? AI_GRADIENT_DISABLED : AI_GRADIENT}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.sendBtn}
                >
                  {loading
                    ? <ActivityIndicator size="small" color="#FFFFFF" />
                    : <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F4F4F4',
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  // 화면 정중앙 고정 — absolute positioning + pointerEvents="none".
  // 좌우 그룹의 폭이 달라도 title은 항상 screen center에 위치.
  // 우측 그룹은 별개의 sibling이라 클릭은 정상 작동.
  headerTitleRow: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  headerSparkle: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: 7,
    flexShrink: 0,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.3 },

  // 헤더 우측 — pill만 표시. countdown은 쿼터 0일 때 본문 모듈로 분리.
  headerRight: {
    flexDirection: 'row', alignItems: 'center',
  },
  quotaPillWrap: {
    minWidth: 36, height: 36, alignItems: 'flex-end', justifyContent: 'center',
    paddingRight: 4,
  },
  // 쿼터 소진 배너 — 5/5 다 쓴 경우만 본문 상단에 표시
  quotaResetBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#F5F0FA',
    borderRadius: 12,
    borderWidth: 1, borderColor: '#E5D6F0',
  },
  quotaResetBannerText: {
    flex: 1,
    fontSize: 13, color: '#5A5A5F', lineHeight: 19,
  },
  quotaResetBannerStrong: {
    color: '#7A52B5', fontWeight: '700',
  },
  quotaPillFree: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F5F0FA',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12,
  },
  quotaPillFreeText: {
    fontSize: 12, fontWeight: '700', color: '#7A52B5', letterSpacing: -0.2,
  },
  quotaPillEmpty: {
    backgroundColor: '#FCEEF0',
  },
  quotaPillEmptyText: {
    color: '#D96570',
  },
  quotaPillPremium: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 12,
  },
  quotaPillPremiumText: {
    fontSize: 12, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2,
  },

  // 히어로
  heroWrap: { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  orbWrap: {
    width: 120, height: 120, alignItems: 'center', justifyContent: 'center',
  },
  orbHalo: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.35,
  },
  orbHaloInner: {
    width: '100%', height: '100%', borderRadius: 60,
  },
  orbCore: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#9168C0', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },
  greeting: {
    fontSize: 28, fontWeight: '800', color: '#1A1A1A',
    textAlign: 'center', letterSpacing: -0.7, lineHeight: 36,
    marginBottom: 8,
  },
  greetingSub: {
    fontSize: 13.5, color: '#888', textAlign: 'center',
    lineHeight: 20, paddingHorizontal: 12,
  },

  // 추천 카드 그리드
  suggestGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    width: '100%', gap: 10,
  },
  suggestCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  suggestCardIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  suggestCardText: {
    fontSize: 13.5, fontWeight: '600', color: '#1A1A1A',
    lineHeight: 19, letterSpacing: -0.2,
  },

  // 챗
  chatWrap: { paddingHorizontal: 18, paddingTop: 18 },

  // 사용자 질문 버블
  userBubbleRow: {
    alignItems: 'flex-end', marginBottom: 16,
  },
  userBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: 20, borderBottomRightRadius: 4,
    shadowColor: '#9168C0', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  userBubbleText: {
    fontSize: 14.5, color: '#FFFFFF', fontWeight: '600', letterSpacing: -0.2,
  },

  // AI 응답
  aiRow: {
    flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14,
  },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10, marginTop: 2,
  },
  aiMessage: {
    fontSize: 15, color: '#1A1A1A', fontWeight: '600',
    letterSpacing: -0.3, lineHeight: 22, paddingTop: 5,
  },
  thinkingBubble: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F4FB', borderRadius: 16, borderTopLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  thinkingText: {
    fontSize: 13.5, color: '#7A52B5', fontWeight: '500', letterSpacing: -0.2,
  },

  // 레시피 카드
  recipeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F0F0F0',
    borderRadius: 18, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  recipeImage: {
    width: 78, height: 78, borderRadius: 14, marginRight: 12,
  },
  recipeBody: { flex: 1 },
  recipeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recipeTitle: {
    flex: 1, fontSize: 15.5, fontWeight: '700', color: '#1A1A1A',
    letterSpacing: -0.3, marginRight: 6,
  },
  categoryPillWrap: { flexDirection: 'row', marginTop: 4 },
  categoryPill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  categoryPillText: {
    fontSize: 10.5, fontWeight: '700', color: '#7A52B5', letterSpacing: -0.2,
  },
  recipeReason: {
    fontSize: 12.5, color: '#666', marginTop: 6, lineHeight: 17,
  },

  quotaText: {
    fontSize: 11.5, color: '#999', textAlign: 'center',
    marginTop: 14, marginBottom: 4,
  },

  // 하단 고정 입력 바
  composerWrap: {
    paddingHorizontal: 14, paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F4F4F4',
  },
  composerBorder: {
    borderRadius: 26,
    padding: 1.5,
  },
  composerInner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  composerInput: {
    flex: 1, fontSize: 14.5, color: '#1A1A1A',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
});
