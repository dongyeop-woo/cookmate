import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCommunityRecipe } from '../../services/api';
import type { CommunityRecipe } from '../../constants/community';
import { useAuth } from '../_layout';

const { width } = Dimensions.get('window');
const CATEGORIES = ['아침', '점심', '저녁', '디저트', '간식', '음료'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];
const DRAFT_KEY = 'recipe_draft';

export default function WriteRecipeScreen() {
  const router = useRouter();
  const { userProfile, firebaseUser } = useAuth();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState(userProfile?.nickname || firebaseUser?.displayName || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('점심');
  const [difficulty, setDifficulty] = useState('보통');
  const [time, setTime] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [calories, setCalories] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageReady, setImageReady] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState([{ description: '', time: '', timeSeconds: '' }]);

  const getDraftData = () => ({
    title, author, description, category, difficulty, time, timeSeconds, calories,
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
  }, [title, description, ingredients, steps, images, author, category, difficulty, time, timeSeconds, calories]);

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return false;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 3,
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

  useEffect(() => {
    const init = async () => {
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

    const showWarningThenPick = () => {
      Alert.alert(
        '⚠️ 사진 업로드 주의사항',
        '음란물, 폭력적이거나 음식과 관련 없는 사진을 업로드할 경우 검토 후 계정이 차단되며, 관련 법률에 따라 법적 책임을 질 수 있습니다.',
        [
          {
            text: '취소',
            style: 'cancel',
            onPress: () => router.back(),
          },
          {
            text: '확인',
            onPress: async () => {
              const picked = await pickImages();
              if (!picked) router.back();
            },
          },
        ],
        { cancelable: false },
      );
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

  if (!imageReady) {
    return <View style={{ flex: 1, backgroundColor: 'transparent' }} />;
  }

  const addIngredient = () => setIngredients([...ingredients, { name: '', amount: '' }]);
  const removeIngredient = (idx: number) => {
    if (ingredients.length > 1) setIngredients(ingredients.filter((_, i) => i !== idx));
  };
  const updateIngredient = (idx: number, field: 'name' | 'amount', value: string) => {
    const updated = [...ingredients];
    updated[idx][field] = value;
    setIngredients(updated);
  };

  const addStep = () => setSteps([...steps, { description: '', time: '', timeSeconds: '' }]);
  const removeStep = (idx: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, i) => i !== idx));
  };
  const updateStep = (idx: number, field: 'description' | 'time' | 'timeSeconds', value: string) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return Alert.alert('알림', '레시피 이름을 입력해주세요');
    if (!author.trim()) return Alert.alert('알림', '작성자 이름을 입력해주세요');
    if (!time.trim() && !timeSeconds.trim()) return Alert.alert('알림', '조리 시간을 입력해주세요');
    const validIngredients = ingredients.filter(i => i.name.trim());
    if (validIngredients.length === 0) return Alert.alert('알림', '재료를 최소 1개 입력해주세요');
    const validSteps = steps.filter(s => s.description.trim());
    if (validSteps.length === 0) return Alert.alert('알림', '조리 단계를 최소 1개 입력해주세요');

    const recipe = {
      title: title.trim(),
      author: author.trim(),
      authorUid: firebaseUser?.uid || '',
      description: description.trim(),
      category,
      time: (parseInt(time) || 0) * 60 + (parseInt(timeSeconds) || 0),
      difficulty,
      image: images[0] || '',
      images: images,
      ingredients: validIngredients.map(i => ({ name: i.name.trim(), amount: i.amount.trim() })),
      steps: validSteps.map(s => ({
        description: s.description.trim(),
        time: (parseFloat(s.time) || 0) * 60 + (parseFloat(s.timeSeconds) || 0),
      })),
      createdAt: new Date().toISOString(),
      ratings: [],
      questions: [],
      likes: 0,
    };

    try {
      await createCommunityRecipe(recipe as Omit<CommunityRecipe, 'id'>);
      await clearDraft();
      Alert.alert('완료', '레시피가 등록되었어요!', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('오류', '레시피 등록에 실패했어요.');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          {/* Hero Image Area */}
          <View style={styles.imageContainer}>
            {images.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                  setActiveImageIndex(idx);
                }}
              >
                {images.map((uri, idx) => (
                  <Image key={idx} source={{ uri }} style={styles.heroImage} />
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

            {/* Image Indicators */}
            {images.length > 1 && (
              <View style={styles.indicatorRow}>
                {images.map((_, idx) => (
                  <View key={idx} style={[styles.indicator, activeImageIndex === idx && styles.indicatorActive]} />
                ))}
              </View>
            )}

            {/* Image Count Badge */}
            {images.length > 0 && (
              <View style={styles.imageBadge}>
                <Text style={styles.imageBadgeText}>{images.length}/3</Text>
              </View>
            )}

            {/* Overlay Buttons */}
            <SafeAreaView style={styles.imageOverlay}>
              <TouchableOpacity style={styles.overlayBtn} onPress={handleBack}>
                <Text style={styles.overlayBtnIcon}>←</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {/* Title + Author */}
            <TextInput
              style={styles.titleInput}
              placeholder="레시피 이름"
              placeholderTextColor="#BDBDBD"
              value={title}
              onChangeText={setTitle}
            />
            <View style={styles.authorRow}>
              <Text style={styles.authorPrefix}>By</Text>
              <TextInput
                style={styles.authorInput}
                placeholder="닉네임"
                placeholderTextColor="#BDBDBD"
                value={author}
                onChangeText={setAuthor}
              />
            </View>

            {/* Info Row */}
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>◷</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="0"
                  placeholderTextColor="#BDBDBD"
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numeric"
                />
                <Text style={styles.infoUnit}>분</Text>
                <TextInput
                  style={[styles.infoInput, { marginLeft: 4 }]}
                  placeholder="0"
                  placeholderTextColor="#BDBDBD"
                  value={timeSeconds}
                  onChangeText={setTimeSeconds}
                  keyboardType="numeric"
                />
                <Text style={styles.infoUnit}>초</Text>
              </View>
              <View style={styles.infoDivider} />
              <TouchableOpacity
                style={styles.infoItem}
                onPress={() => {
                  const idx = DIFFICULTIES.indexOf(difficulty);
                  setDifficulty(DIFFICULTIES[(idx + 1) % DIFFICULTIES.length]);
                }}
              >
                <Text style={styles.infoIcon}>◈</Text>
                <Text style={styles.infoText}>{difficulty}</Text>
              </TouchableOpacity>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>♨</Text>
                <TextInput
                  style={styles.infoInput}
                  placeholder="0"
                  placeholderTextColor="#BDBDBD"
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                />
                <Text style={styles.infoUnit}>cal</Text>
              </View>
            </View>

            {/* Category */}
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === c && styles.chipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

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
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ingredients</Text>
                <TouchableOpacity onPress={addIngredient} style={styles.addBtn}>
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
                  <View style={styles.ingredientLeft}>
                    <TextInput
                      style={styles.ingredientNameInput}
                      placeholder="재료명"
                      placeholderTextColor="#BDBDBD"
                      value={ing.name}
                      onChangeText={(v) => updateIngredient(idx, 'name', v)}
                    />
                  </View>
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
                <TouchableOpacity onPress={addStep} style={styles.addBtn}>
                  <Text style={styles.addBtnText}>+ 추가</Text>
                </TouchableOpacity>
              </View>
              {steps.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={1}
                  onLongPress={() => removeStep(idx)}
                  style={styles.stepRow}
                >
                  <View style={styles.stepNumberCircle}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <TextInput
                      style={styles.stepDescInput}
                      placeholder={`${idx + 1}단계를 설명해주세요`}
                      placeholderTextColor="#BDBDBD"
                      value={s.description}
                      onChangeText={(v) => updateStep(idx, 'description', v)}
                      multiline
                    />
                    <View style={styles.stepTimeRow}>
                      <Text style={styles.stepTimeIcon}>◷</Text>
                      <TextInput
                        style={styles.stepTimeInput}
                        placeholder="0"
                        placeholderTextColor="#BDBDBD"
                        value={s.time}
                        onChangeText={(v) => updateStep(idx, 'time', v)}
                        keyboardType="numeric"
                      />
                      <Text style={styles.stepTimeUnit}>분</Text>
                      <TextInput
                        style={[styles.stepTimeInput, { marginLeft: 4 }]}
                        placeholder="0"
                        placeholderTextColor="#BDBDBD"
                        value={s.timeSeconds}
                        onChangeText={(v) => updateStep(idx, 'timeSeconds', v)}
                        keyboardType="numeric"
                      />
                      <Text style={styles.stepTimeUnit}>초</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              <Text style={styles.hintText}>길게 눌러서 단계 삭제</Text>
            </View>

            <View style={{ height: 100 }} />
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.ctaButton} onPress={handleSubmit} activeOpacity={0.85}>
            <Text style={styles.ctaText}>레시피 등록하기</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Hero Image
  imageContainer: {
    width: '100%',
    height: width * 0.85,
    position: 'relative',
  },
  heroImage: {
    width: width,
    height: width * 0.85,
    resizeMode: 'cover',
  },
  indicatorRow: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  indicatorActive: {
    backgroundColor: '#FFFFFF',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
  },
  overlayBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overlayBtnIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },

  // Content
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    paddingVertical: 0,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
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
    paddingHorizontal: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIcon: {
    fontSize: 16,
    color: '#0B9A61',
    marginRight: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  infoInput: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
    paddingVertical: 0,
    minWidth: 20,
    textAlign: 'center',
  },
  infoUnit: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
    marginLeft: 2,
  },
  infoDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E0E0E0',
  },

  // Category Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  chipActive: {
    backgroundColor: '#0B9A61',
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
    backgroundColor: '#E8F5EF',
    marginBottom: 16,
  },
  addBtnText: {
    fontSize: 13,
    color: '#0B9A61',
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
    backgroundColor: '#0B9A61',
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
  stepTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stepTimeIcon: {
    fontSize: 13,
    color: '#0B9A61',
    marginRight: 4,
  },
  stepTimeInput: {
    fontSize: 13,
    color: '#0B9A61',
    fontWeight: '600',
    paddingVertical: 0,
    minWidth: 16,
    textAlign: 'center',
  },
  stepTimeUnit: {
    fontSize: 13,
    color: '#0B9A61',
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  ctaButton: {
    backgroundColor: '#0B9A61',
    borderRadius: 18,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B9A61',
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
});
