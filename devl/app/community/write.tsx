import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  BackHandler,
  Keyboard,
  DeviceEventEmitter,
} from 'react-native';
import { RECIPE_INGREDIENT_PICKED } from '../recipe-ingredient-add';
import { RECIPE_STEP_PICKED } from '../recipe-step-add';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCommunityRecipe, fetchCommunityRecipeById, updateCommunityRecipeApi, uploadRecipeImage } from '../../services/api';
import type { CommunityRecipe } from '../../constants/community';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';

const GUIDE_WRITE_KEY = (uid: string) => `guide_write_shown_${uid}`;

const GUIDE_STEPS = [
  {
    iconName: 'star' as const,
    iconColor: '#F5A623',
    iconBg: '#FEF3E2',
    iconRing: '#FDF0D5',
    title: '레시피 제출하면\n포인트가 지급돼요',
    desc: '관리자 승인을 받으면\n포인트가 자동으로 적립돼요.',
    badge: '승인 1건 = 100P',
    bullets: null as null | { icon: any; text: string }[],
  },
  {
    iconName: 'gift' as const,
    iconColor: '#7C5CBF',
    iconBg: '#EEE8F9',
    iconRing: '#F5F0FC',
    title: '포인트로\n기프티콘을 받아요',
    desc: '쌓인 포인트를 모아\n기프티콘으로 바로 교환하세요.',
    badge: '2,000P = 1,000원 기프티콘',
    bullets: null as null | { icon: any; text: string }[],
  },
  {
    iconName: 'clipboard-outline' as const,
    iconColor: '#1A1A1A',
    iconBg: '#D0F0E2',
    iconRing: '#EAF7F1',
    title: '이렇게 쓰면\n빨리 승인돼요',
    desc: null as null | string,
    badge: null as null | string,
    bullets: [
      { icon: 'camera-outline' as const, text: '완성된 요리 사진 포함' },
      { icon: 'list-outline' as const, text: '재료명과 양을 모두 기재' },
      { icon: 'footsteps-outline' as const, text: '조리 단계를 3개 이상 구체적으로' },
      { icon: 'time-outline' as const, text: '하루 최대 2개 · 승인까지 최대 1영업일' },
    ],
  },
];

const { width } = Dimensions.get('window');
const CATEGORIES = ['아침', '점심', '저녁', '디저트', '간식', '음료', '야식', '분식', '한식', '양식'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];
const DRAFT_KEY = 'recipe_draft';

export default function WriteRecipeScreen() {
  const router = useRouter();
  const { resubmitId } = useLocalSearchParams<{ resubmitId?: string }>();
  const { userProfile, firebaseUser } = useAuth();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState(userProfile?.nickname || firebaseUser?.displayName || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('점심');
  const [difficulty, setDifficulty] = useState('보통');
  const [time, setTime] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [calories, setCalories] = useState('');
  const [servings, setServings] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageReady, setImageReady] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState<{ description: string; time: string; timeSeconds: string; imageUrl?: string; isAiImage?: boolean }[]>([{ description: '', time: '', timeSeconds: '', imageUrl: '', isAiImage: false }]);
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const ingredientsLayoutRef = useRef({ y: 0, h: 0 });
  const pendingScrollToIngredientsEnd = useRef(false);

  const [submitting, setSubmitting] = useState(false);

  // 키보드 높이/표시 — bottomBar 숨김 + ScrollView 하단 패딩 동적 조절
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardVisible = keyboardHeight > 0;
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // 재료 추가 페이지에서 선택 완료 시 수신
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(RECIPE_INGREDIENT_PICKED, (payload: { index: number; name: string; amount: string }) => {
      setIngredients((prev) => {
        if (payload.index >= 0 && payload.index < prev.length) {
          const updated = [...prev];
          updated[payload.index] = { name: payload.name, amount: payload.amount || updated[payload.index].amount };
          return updated;
        }
        // 새 추가: 마지막 빈 row가 있으면 그 자리 사용, 아니면 append
        const firstEmpty = prev.findIndex(i => !i.name.trim() && !i.amount.trim());
        if (firstEmpty >= 0) {
          const updated = [...prev];
          updated[firstEmpty] = { name: payload.name, amount: payload.amount };
          return updated;
        }
        pendingScrollToIngredientsEnd.current = true;
        return [...prev, { name: payload.name, amount: payload.amount }];
      });
    });
    return () => sub.remove();
  }, []);

  // 단계 추가 페이지에서 입력 완료 시 수신
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(RECIPE_STEP_PICKED, (payload: { index: number; description: string; time: string; timeSeconds: string; imageUrl?: string; isAiImage?: boolean }) => {
      setSteps((prev) => {
        const newStep = { description: payload.description, time: payload.time, timeSeconds: payload.timeSeconds, imageUrl: payload.imageUrl || '', isAiImage: !!payload.isAiImage };
        if (payload.index >= 0 && payload.index < prev.length) {
          const updated = [...prev];
          updated[payload.index] = newStep;
          return updated;
        }
        const firstEmpty = prev.findIndex(s => !s.description.trim());
        if (firstEmpty >= 0) {
          const updated = [...prev];
          updated[firstEmpty] = newStep;
          return updated;
        }
        // 최대 15단계 제한
        if (prev.length >= 15) {
          Alert.alert('단계 제한', '레시피 단계는 최대 15개까지 추가할 수 있어요.');
          return prev;
        }
        return [...prev, newStep];
      });
    });
    return () => sub.remove();
  }, []);
  const guideScrollRef = useRef<ScrollView>(null);
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showGuide || guideStep !== 0) {
      swipeOpacity.setValue(0);
      return;
    }
    swipeX.setValue(60);
    Animated.sequence([
      Animated.delay(700),
      Animated.timing(swipeOpacity, { toValue: 0.6, duration: 300, useNativeDriver: true }),
      Animated.timing(swipeX, { toValue: -60, duration: 800, useNativeDriver: true }),
      Animated.timing(swipeOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [showGuide, guideStep]);

  const getDraftData = () => ({
    title, author, description, category, difficulty, time, timeSeconds, calories, servings,
    images, ingredients, steps,
  });

  const saveDraft = async () => {
    try {
      await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftData()));
    } catch {}
  };

  const clearDraft = async () => {
    try { await AsyncStorage.removeItem(DRAFT_KEY); } catch {}
  };

  const hasDraft = async () => {
    try {
      const json = await AsyncStorage.getItem(DRAFT_KEY);
      return !!json;
    } catch { return false; }
  };

  const loadDraft = async () => {
    try {
      const json = await AsyncStorage.getItem(DRAFT_KEY);
      if (!json) return false;
      const d = JSON.parse(json);
      if (d.title) setTitle(d.title);
      if (d.author) setAuthor(d.author);
      if (d.description) setDescription(d.description);
      if (d.category) setCategory(d.category);
      if (d.difficulty) setDifficulty(d.difficulty);
      if (d.time) setTime(d.time);
      if (d.timeSeconds) setTimeSeconds(d.timeSeconds);
      if (d.calories) setCalories(d.calories);
      if (d.servings) setServings(d.servings);
      if (d.images?.length) { setImages(d.images); setImageReady(true); }
      if (d.ingredients?.length) setIngredients(d.ingredients);
      if (d.steps?.length) setSteps(d.steps);
      return d.images?.length > 0;
    } catch { return false; }
  };

  const handleBack = useCallback(() => {
    const hasContent = title.trim() || description.trim() ||
      ingredients.some(i => i.name.trim()) || steps.some(s => s.description.trim());
    if (!hasContent) {
      clearDraft();
      router.back();
      return;
    }
    Alert.alert('임시 저장', '작성 중인 레시피를 임시 저장할까요?', [
      { text: '삭제', style: 'destructive', onPress: () => { clearDraft(); router.back(); } },
      { text: '임시 저장', onPress: async () => { await saveDraft(); router.back(); } },
      { text: '계속 작성', style: 'cancel' },
    ]);
  }, [title, description, ingredients, steps, images, author, category, difficulty, time, timeSeconds, calories, servings]);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return false;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImages(result.assets.map(a => a.uri));
      setImageReady(true);
      return true;
    }
    return false;
  };

  const pickStepImage = async (idx: number) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, imageUrl: uri } : s));
    }
  };

  useEffect(() => {
    const init = async () => {
      // 재제출 모드: 기존 레시피 데이터 불러와서 폼 채우기
      if (resubmitId) {
        try {
          const recipe = await fetchCommunityRecipeById(resubmitId);
          setTitle(recipe.title);
          setAuthor(recipe.author);
          setDescription(recipe.description);
          setCategory(recipe.category);
          setDifficulty(recipe.difficulty);
          const totalSec = recipe.time;
          setTime(String(Math.floor(totalSec / 60)));
          setTimeSeconds(String(totalSec % 60));
          if (recipe.images?.length) {
            setImages(recipe.images);
          } else if (recipe.image) {
            setImages([recipe.image]);
          }
          setImageReady(true);
          setIngredients(recipe.ingredients.length ? recipe.ingredients : [{ name: '', amount: '' }]);
          if (recipe.servings) setServings(String(recipe.servings));
          setSteps(recipe.steps.length
            ? recipe.steps.map(s => ({
                description: s.description,
                time: String(Math.floor(s.time / 60)),
                timeSeconds: String(s.time % 60),
                imageUrl: s.imageUrl || '',
                isAiImage: !!(s as any).isAiImage,
              }))
            : [{ description: '', time: '', timeSeconds: '', imageUrl: '', isAiImage: false }]
          );
        } catch {
          Alert.alert('오류', '레시피를 불러오지 못했습니다.');
          router.back();
        }
        return;
      }

      const guideShown = await AsyncStorage.getItem(GUIDE_WRITE_KEY(firebaseUser?.uid || ''));
      if (!guideShown) {
        setShowGuide(true);
        return;
      }

      const draftExists = await hasDraft();
      if (draftExists) {
        Alert.alert(
          '임시 저장된 글',
          '이전에 작성하던 레시피가 있어요.\n이어서 작성할까요?',
          [
            {
              text: '새로 작성',
              style: 'destructive',
              onPress: async () => {
                await clearDraft();
                showWarningThenPick();
              },
            },
            {
              text: '이어서 작성',
              onPress: async () => {
                await loadDraft();
              },
            },
          ],
          { cancelable: false },
        );
        return;
      }
      showWarningThenPick();
    };

    init();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  const showWarningThenPick = () => {
    Alert.alert(
      '⚠️ 사진 업로드 주의사항',
      `음란물, 폭력적이거나 음식과 관련 없는 사진을 업로드할 경우 검토 후 계정이 차단되며, 관련 법률에 따라 법적 책임을 질 수 있습니다.\n\n📷 권장 규격\n• 정사각형에 가까운 비율 권장 (20:19)\n• 가로로 촬영한 사진 권장 (세로 사진은 위아래가 잘릴 수 있어요)\n• 표시 영역: ${Math.round(width)}×${Math.round(width * 0.95)}px`,
      [
        { text: '취소', style: 'cancel', onPress: () => router.back() },
        { text: '확인', onPress: async () => { const picked = await pickImages(); if (!picked) router.back(); } },
      ],
      { cancelable: false },
    );
  };

  const handleGuideConfirm = async () => {
    await AsyncStorage.setItem(GUIDE_WRITE_KEY(firebaseUser?.uid || ''), '1');
    setShowGuide(false);
    setGuideStep(0);
    const draftExists = await hasDraft();
    if (draftExists) {
      Alert.alert(
        '임시 저장된 글',
        '이전에 작성하던 레시피가 있어요.\n이어서 작성할까요?',
        [
          { text: '새로 작성', style: 'destructive', onPress: async () => { await clearDraft(); showWarningThenPick(); } },
          { text: '이어서 작성', onPress: loadDraft },
        ],
        { cancelable: false },
      );
      return;
    }
    showWarningThenPick();
  };

  if (showGuide) {
    const isLast = guideStep === GUIDE_STEPS.length - 1;
    return (
      <View style={styles.guideScreen}>
        {/* X 버튼 */}
        <SafeAreaView style={styles.guideCloseWrap} edges={['top']}>
          <TouchableOpacity style={styles.guideCloseBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="#888" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* 스와이프 페이지 */}
        <ScrollView
          ref={guideScrollRef}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            setGuideStep(idx);
          }}
          style={{ flex: 1 }}
        >
          {GUIDE_STEPS.map((step, i) => (
            <View key={i} style={styles.guidePage}>
              <View style={styles.guideIconArea}>
                <View style={[styles.guideIconRing, { backgroundColor: step.iconRing }]}>
                  <View style={[styles.guideIconCircle, { backgroundColor: step.iconBg }]}>
                    <Ionicons name={step.iconName} size={44} color={step.iconColor} />
                  </View>
                </View>
              </View>
              <View style={{ width: '100%' }}>
                <Text style={styles.guideStepTitle}>{step.title}</Text>
                {step.desc ? <Text style={styles.guideStepDesc}>{step.desc}</Text> : null}
                {step.badge ? (
                  <View style={styles.guideBadge}>
                    <Text style={styles.guideBadgeText}>{step.badge}</Text>
                  </View>
                ) : null}
                {step.bullets ? (
                  <View style={styles.guideBullets}>
                    {step.bullets.map((b, j) => (
                      <View key={j} style={styles.guideBulletRow}>
                        <View style={styles.guideBulletIconWrap}>
                          <Ionicons name={b.icon} size={16} color="#1A1A1A" />
                        </View>
                        <Text style={styles.guideBulletText}>{b.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* 스와이프 힌트 */}
        {guideStep === 0 && (
          <Animated.View style={[styles.swipeHint, { opacity: swipeOpacity }]} pointerEvents="none">
            <Animated.View style={[styles.swipeHintHand, { transform: [{ translateX: swipeX }] }]}>
              <Ionicons name="hand-left" size={72} color="#fff" />
            </Animated.View>
          </Animated.View>
        )}

        {/* 하단 고정 영역 */}
        <View style={styles.guideBottom}>
          <View style={styles.guideDots}>
            {GUIDE_STEPS.map((_, i) => (
              <View key={i} style={[styles.guideDot, i === guideStep && styles.guideDotActive]} />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.guideStartBtn, !isLast && styles.guideSkipBtn]}
            onPress={handleGuideConfirm}
          >
            <Text style={[styles.guideStartText, !isLast && styles.guideSkipText]}>
              {isLast ? '시작하기' : '건너뛰기'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!imageReady) {
    return <View style={{ flex: 1, backgroundColor: 'transparent' }} />;
  }

  const removeIngredient = (idx: number) => {
    if (ingredients.length > 1) setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: 'name' | 'amount', value: string) => {
    const updated = [...ingredients];
    updated[idx][field] = value;
    setIngredients(updated);
  };

  const removeStep = (idx: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (submitting) {
      Alert.alert('알림', '제출 중입니다. 잠시만 기다려주세요.');
      return;
    }
    if (!title.trim()) return Alert.alert('알림', '레시피 이름을 입력해주세요');
    if (!author.trim()) return Alert.alert('알림', '작성자 이름을 입력해주세요');
    if (!time.trim() && !timeSeconds.trim()) return Alert.alert('알림', '조리 시간을 입력해주세요');
    const validIngredients = ingredients.filter(i => i.name.trim());
    if (validIngredients.length === 0) return Alert.alert('알림', '재료를 최소 1개 입력해주세요');
    const validSteps = steps.filter(s => s.description.trim());
    if (validSteps.length === 0) return Alert.alert('알림', '조리 단계를 최소 1개 입력해주세요');

    setSubmitting(true);


    // 시간: 분 + (초 ÷ 60)을 분 단위로 저장 (기존 DB 일관성)
    const totalMinutes = (parseInt(time) || 0) + Math.round((parseInt(timeSeconds) || 0) / 60);

    // 로컬 이미지(file://)를 Firebase Storage로 업로드 → 공개 URL 획득
    let uploadedImages: string[] = [];
    try {
      uploadedImages = await Promise.all(
        images.map(async (uri) => {
          if (uri.startsWith('http')) return uri; // 이미 업로드된 URL
          return await uploadRecipeImage(firebaseUser?.uid || 'guest', uri);
        })
      );
    } catch (e) {
      Alert.alert('이미지 업로드 실패', '사진을 업로드하는 중 오류가 발생했어요.');
      setSubmitting(false);
      return;
    }

    // 단계별 사진 업로드 (로컬 경로면 Storage로 올림)
    let uploadedStepImages: string[] = [];
    try {
      uploadedStepImages = await Promise.all(
        validSteps.map(async (s) => {
          if (!s.imageUrl) return '';
          if (s.imageUrl.startsWith('http')) return s.imageUrl;
          return await uploadRecipeImage(firebaseUser?.uid || 'guest', s.imageUrl);
        })
      );
    } catch (e) {
      Alert.alert('단계 사진 업로드 실패', '단계별 사진 업로드 중 오류가 발생했어요.');
      setSubmitting(false);
      return;
    }

    const recipeData = {
      title: title.trim(),
      author: author.trim(),
      authorUid: firebaseUser?.uid || '',
      description: description.trim(),
      category,
      time: totalMinutes,
      difficulty,
      calories: parseInt(calories) || 0,
      servings: servings.trim() || '1',
      image: uploadedImages[0] || '',
      images: uploadedImages,
      ingredients: validIngredients.map(i => ({ name: i.name.trim(), amount: i.amount.trim() })),
      steps: validSteps.map((s, i) => ({
        description: s.description.trim(),
        time: (parseFloat(s.time) || 0) + (parseFloat(s.timeSeconds) || 0) / 60,
        imageUrl: uploadedStepImages[i] || undefined,
        isAiImage: !!s.isAiImage,
      })),
      ratings: [],
      questions: [],
      likes: 0,
      status: 'pending' as const,
      rejectionReason: undefined,
    };

    try {
      if (resubmitId) {
        await updateCommunityRecipeApi({ ...recipeData, id: resubmitId, createdAt: new Date().toISOString() });
      } else {
        await createCommunityRecipe({ ...recipeData, createdAt: new Date().toISOString() } as Omit<CommunityRecipe, 'id'>);
      }
      await clearDraft();
      Alert.alert(
        resubmitId ? '재제출 완료' : '등록 완료',
        '레시피가 제출되었어요!\n승인까지 최대 1영업일이 소요됩니다.',
        [{ text: '확인', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('오류', '레시피 등록에 실패했어요.');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 스크롤과 무관하게 항상 보이는 뒤로가기 — 레시피 상세 페이지 패턴 */}
      <SafeAreaView style={styles.imageOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.overlayBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </SafeAreaView>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            paddingBottom: keyboardVisible
              ? (Platform.OS === 'android' ? keyboardHeight + 40 : 40)
              : 120,
          }}
        >
          {/* Hero Image Area */}
          <View style={styles.imageContainer}>
            {images.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setActiveImageIndex((prev) => (prev === idx ? prev : idx));
                }}
              >
                {images.map((uri, idx) => (
                  <Image key={idx} source={{ uri }} style={styles.heroImage} cachePolicy="disk" />
                ))}
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.heroPlaceholder}>
                  <Text style={styles.placeholderIcon}>📷</Text>
                  <Text style={styles.placeholderText}>사진을 추가해주세요</Text>
                  <Text style={styles.placeholderSub}>탭하여 앨범에서 선택</Text>
                </View>
              </View>
            )}

          </View>

          {/* Image Indicators (이미지 아래) */}
          {images.length > 1 && (
            <View style={styles.indicatorRow}>
              {images.map((_, idx) => (
                <View key={idx} style={[styles.indicator, activeImageIndex === idx && styles.indicatorActive]} />
              ))}
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Title + Author */}
            <TextInput
              style={styles.titleInput}
              placeholder="레시피 이름"
              placeholderTextColor="#BDBDBD"
              value={title}
              onChangeText={setTitle}
              maxLength={20}
            />
            <View style={styles.authorRow}>
              {userProfile?.profileImage && userProfile.profileImage !== 'default' && userProfile.profileImage.startsWith('http') ? (
                <Image source={{ uri: userProfile.profileImage }} style={styles.authorAvatar} cachePolicy="disk" />
              ) : (
                <Image source={userProfile?.gender === 'female' ? require('../../assets/girl.png') : require('../../assets/man.png')} style={styles.authorAvatar as any} />
              )}
              <Text style={styles.author}>{author || '닉네임'}</Text>
            </View>

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={[styles.infoItem, { flex: 1.5 }]}>
                <TextInput
                  style={styles.infoInput}
                  placeholder="0"
                  placeholderTextColor="#BDBDBD"
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numeric"
                />
                <Text style={styles.infoUnit}> 분</Text>
                <TextInput
                  style={[styles.infoInput, { marginLeft: 4 }]}
                  placeholder="0"
                  placeholderTextColor="#BDBDBD"
                  value={timeSeconds}
                  onChangeText={setTimeSeconds}
                  keyboardType="numeric"
                />
                <Text style={styles.infoUnit}> 초</Text>
              </View>
              <View style={styles.infoDivider} />
              <TouchableOpacity
                style={styles.infoItem}
                onPress={() => {
                  const idx = DIFFICULTIES.indexOf(difficulty);
                  setDifficulty(DIFFICULTIES[(idx + 1) % DIFFICULTIES.length]);
                }}
              >
                <Text style={[styles.infoText, { color: difficulty === '쉬움' ? '#1BAE74' : difficulty === '어려움' ? '#E74C3C' : '#F5A623' }]}>{difficulty}</Text>
              </TouchableOpacity>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <TextInput
                  style={styles.infoInput}
                  placeholder="0"
                  placeholderTextColor="#BDBDBD"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                />
                <Text style={styles.infoUnit}> cal</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <TextInput
                  style={styles.infoInput}
                  placeholder="1"
                  placeholderTextColor="#BDBDBD"
                  value={servings}
                  onChangeText={setServings}
                  maxLength={7}
                />
                <Text style={styles.infoUnit}> 인분</Text>
              </View>
            </View>

            {/* Category */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
              contentContainerStyle={styles.chipRowContent}
            >
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={styles.descInput}
                placeholder="이 레시피를 소개해주세요"
                placeholderTextColor="#BDBDBD"
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>

            {/* Ingredients */}
            <View
              style={styles.section}
              onLayout={(e) => {
                ingredientsLayoutRef.current = {
                  y: e.nativeEvent.layout.y,
                  h: e.nativeEvent.layout.height,
                };
                if (pendingScrollToIngredientsEnd.current) {
                  pendingScrollToIngredientsEnd.current = false;
                  const target = ingredientsLayoutRef.current.y + ingredientsLayoutRef.current.h - 240;
                  scrollRef.current?.scrollTo({ y: Math.max(0, target), animated: true });
                }
              }}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/recipe-ingredient-add', params: { index: '-1' } })}
                  style={styles.addBtn}
                >
                  <Text style={styles.addBtnText}>+ 추가</Text>
                </TouchableOpacity>
              </View>
              {ingredients.map((ing, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={1}
                  onLongPress={() => removeIngredient(idx)}
                  style={styles.ingredientRow}
                >
                  <TouchableOpacity
                    style={styles.ingredientLeft}
                    activeOpacity={0.6}
                    onPress={() => router.push({ pathname: '/recipe-ingredient-add', params: { index: String(idx) } })}
                  >
                    <Text
                      style={[
                        styles.ingredientNameInput,
                        !ing.name && styles.ingredientNamePlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {ing.name || '재료명'}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.ingredientAmountInput}
                    placeholder="양"
                    placeholderTextColor="#BDBDBD"
                    value={ing.amount}
                    onChangeText={(v) => updateIngredient(idx, 'amount', v)}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.hintText}>길게 눌러서 재료 삭제</Text>
            </View>

            {/* Steps */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Steps</Text>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/recipe-step-add', params: { index: '-1' } })}
                  style={styles.addBtn}
                >
                  <Text style={styles.addBtnText}>+ 추가</Text>
                </TouchableOpacity>
              </View>
              {steps.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.6}
                  onLongPress={() => removeStep(idx)}
                  onPress={() => router.push({
                    pathname: '/recipe-step-add',
                    params: {
                      index: String(idx),
                      description: s.description,
                      time: s.time,
                      timeSeconds: s.timeSeconds,
                      imageUrl: s.imageUrl || '',
                      isAiImage: s.isAiImage ? 'true' : 'false',
                    },
                  })}
                  style={styles.stepRow}
                >
                  <View style={styles.stepNumberCircle}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    {s.imageUrl ? (
                      <TouchableOpacity onPress={() => pickStepImage(idx)} activeOpacity={0.7}>
                        <View style={styles.stepThumbWrap}>
                          <Image source={{ uri: s.imageUrl }} style={styles.stepThumb} contentFit="cover" cachePolicy="disk" />
                          {s.isAiImage ? (
                            <View style={styles.stepThumbAiBadge}>
                              <Text style={styles.stepThumbAiBadgeText}>AI</Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.stepAddImageBtn} onPress={() => pickStepImage(idx)}>
                        <Ionicons name="camera-outline" size={16} color="#999" />
                        <Text style={styles.stepAddImageText}>사진 추가</Text>
                      </TouchableOpacity>
                    )}
                    <Text
                      style={[
                        styles.stepDescInput,
                        !s.description && styles.stepDescPlaceholder,
                      ]}
                      numberOfLines={3}
                    >
                      {s.description || `${idx + 1}단계를 설명해주세요`}
                    </Text>
                    {(s.time || s.timeSeconds) ? (
                      <View style={styles.stepTimeRow}>
                        <Ionicons name="time-outline" size={14} color="#1A1A1A" />
                        <Text style={styles.stepTimeText}>
                          {s.time ? `${s.time}분 ` : ''}{s.timeSeconds ? `${s.timeSeconds}초` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#C4C4C4" />
                </TouchableOpacity>
              ))}
              <Text style={styles.hintText}>길게 눌러서 단계 삭제</Text>
            </View>

            <View style={{ height: 100 }} />
          </View>
        </ScrollView>

        {/* Bottom CTA — 키보드가 올라오면 숨김 (입력창 가림 방지) */}
        {!keyboardVisible && (
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.ctaButton, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
            >
              <Text style={styles.ctaText}>{submitting ? '제출 중...' : '레시피 등록하기'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Hero Image — 상세페이지와 동일한 비율 (width * 0.95)
  imageContainer: {
    width: '100%',
    height: width * 0.95,
    position: 'relative',
  },
  heroImage: {
    width: width,
    height: width * 0.95,
    resizeMode: 'cover',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  placeholderGuide: {
    marginTop: 16,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    maxWidth: '85%',
  },
  placeholderGuideText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
  },
  indicatorRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  indicatorActive: {
    backgroundColor: '#1A1A1A',
    width: 18,
  },
  imageBadge: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  placeholderSub: {
    fontSize: 13,
    color: '#9E9E9E',
    marginTop: 4,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  overlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBtnIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },

  // Content
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    height: 52,
    lineHeight: 32,
    paddingTop: Platform.OS === 'ios' ? 10 : 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '600',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  author: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  authorPrefix: {
    fontSize: 14,
    color: '#9E9E9E',
    marginRight: 4,
  },
  authorInput: {
    fontSize: 14,
    color: '#9E9E9E',
    flex: 1,
    paddingVertical: 0,
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 4,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  infoIcon: {
    fontSize: 12,
    color: '#1A1A1A',
    marginRight: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '700',
    flexShrink: 1,
  },
  infoInput: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '700',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 14,
    textAlign: 'center',
  },
  infoUnit: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '500',
    marginLeft: 1,
  },
  infoDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },

  // 단계 썸네일 AI 배지
  stepThumbWrap: { position: 'relative' },
  stepThumbAiBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  stepThumbAiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Category Chips — content의 paddingHorizontal: 24를 negate하여 화면 끝까지 스크롤 영역 확장.
  // 시작 위치는 contentContainerStyle paddingLeft: 24로 맞추고, 오른쪽은 padding 24로 끝 여백 확보.
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 8,
    marginHorizontal: -24,
  },
  chipRowContent: {
    gap: 6,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#1BAE74',
  },
  chipText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Sections
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  descInput: {
    fontSize: 15,
    color: '#666',
    lineHeight: 24,
    minHeight: 60,
    paddingVertical: 0,
  },

  // Ingredients
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#1BAE74',
    marginBottom: 16,
  },
  addBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  ingredientLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ingredientIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  ingredientEmoji: {
    fontSize: 22,
  },
  ingredientNameInput: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
    flex: 1,
    paddingVertical: 0,
  },
  ingredientNamePlaceholder: {
    color: '#BDBDBD',
  },
  ingredientAmountInput: {
    fontSize: 15,
    color: '#9E9E9E',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: 0,
  },
  hintText: {
    fontSize: 12,
    color: '#CDCDCD',
    textAlign: 'center',
    marginTop: 10,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  stepNumberCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1BAE74',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginTop: 14,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  stepDescInput: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
    minHeight: 22,
    paddingVertical: 0,
  },
  stepDescPlaceholder: {
    color: '#BDBDBD',
  },
  stepThumb: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#F0F0F0',
  },
  stepAddImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D0D0D0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  stepAddImageText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  stepTimeText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
    marginLeft: 4,
  },
  stepTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stepTimeIcon: {
    fontSize: 13,
    color: '#1A1A1A',
    marginRight: 4,
  },
  stepTimeInput: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
    paddingVertical: 0,
    minWidth: 16,
    textAlign: 'center',
  },
  stepTimeUnit: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
    marginLeft: 1,
  },

  // Bottom CTA
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 50,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  ctaButton: {
    backgroundColor: '#1BAE74',
    borderRadius: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Guide
  guideScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  guideIconArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  guideIconWrap: {
    alignItems: 'center',
  },
  guideIconRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EAF7F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D0F0E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideStepIcon: {
    fontSize: 46,
  },
  guideCard: {
    backgroundColor: '#fff',
  },
  guideDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  guideDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  guideDotActive: {
    width: 20,
    backgroundColor: '#1A1A1A',
  },
  guideStepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
  },
  guideStepDesc: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 18,
  },
  guideBadge: {
    alignSelf: 'center',
    backgroundColor: '#E8F5EE',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  guideBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  guideBullets: {
    gap: 12,
    marginBottom: 8,
    backgroundColor: '#F5F5F7',
    borderRadius: 14,
    padding: 14,
  },
  guideBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1A1A1A',
  },
  guideBulletIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideBulletText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 19,
    flexShrink: 1,
  },
  guidePage: {
    width,
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideBottom: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 48 : 56,
    paddingTop: 16,
    gap: 16,
    alignItems: 'center',
  },
  guideStartBtn: {
    width: '100%',
    backgroundColor: '#1BAE74',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  guideStartText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  guideSkipBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  guideSkipText: {
    color: '#BDBDBD',
    fontWeight: '600',
  },
  swipeHint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeHintIcon: {
    fontSize: 80,
  },
  swipeHintHand: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideCloseWrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  guideCloseBtn: {
    margin: 20,
    padding: 4,
  },

});
