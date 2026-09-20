import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { fetchRecipeById, updateRecipe, uploadRecipeImage } from '../../services/api';
import type { Recipe } from '../../constants/recipes';
import { useAuth } from '../_layout';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const CATEGORIES = ['아침', '점심', '저녁', '디저트', '간식', '음료', '야식', '분식', '한식', '양식'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];

export default function EditRecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser } = useAuth();

  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('점심');
  const [difficulty, setDifficulty] = useState('보통');
  const [time, setTime] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [calories, setCalories] = useState('');
  const [servings, setServings] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState<{ description: string; time: string; timeSeconds: string; imageUrl?: string; isAiImage?: boolean }[]>([{ description: '', time: '', timeSeconds: '', imageUrl: '', isAiImage: false }]);
  const [originalRecipe, setOriginalRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const recipe = await fetchRecipeById(id);
        setOriginalRecipe(recipe);
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setCategory(recipe.category);
        setDifficulty(recipe.difficulty);
        // 저장된 값은 분 단위(소수 포함 가능) → 분/초로 분리해서 입력 칸에 세팅
        const totalSec = Math.round((recipe.time || 0) * 60);
        setTime(String(Math.floor(totalSec / 60)));
        setTimeSeconds(String(totalSec % 60));
        setCalories(String(recipe.calories || 0));
        setServings(recipe.servings ? String(recipe.servings) : '');
        setImageUri(recipe.image || '');
        if (recipe.ingredients?.length) {
          setIngredients(recipe.ingredients.map(i => ({ name: i.name, amount: i.amount })));
        }
        if (recipe.steps?.length) {
          setSteps(recipe.steps.map(s => {
            const sec = Math.round((s.time || 0) * 60);
            return {
              description: s.description,
              time: String(Math.floor(sec / 60)),
              timeSeconds: String(sec % 60),
              imageUrl: s.imageUrl || '',
              isAiImage: !!(s as any).isAiImage,
            };
          }));
        }
      } catch (e) {
        Alert.alert('오류', '레시피를 불러올 수 없습니다.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const addIngredient = () => setIngredients([...ingredients, { name: '', amount: '' }]);
  const removeIngredient = (idx: number) => {
    if (ingredients.length > 1) setIngredients(ingredients.filter((_, i) => i !== idx));
  };
  const updateIngredientField = (idx: number, field: 'name' | 'amount', value: string) => {
    const updated = [...ingredients];
    updated[idx][field] = value;
    setIngredients(updated);
  };

  const addStep = () => {
    if (steps.length >= 15) {
      Alert.alert('단계 제한', '레시피 단계는 최대 15개까지 추가할 수 있어요.');
      return;
    }
    setSteps([...steps, { description: '', time: '', timeSeconds: '', imageUrl: '', isAiImage: false }]);
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
      const updated = [...steps];
      updated[idx] = { ...updated[idx], imageUrl: result.assets[0].uri };
      setSteps(updated);
    }
  };
  const removeStep = (idx: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, i) => i !== idx));
  };
  const updateStepField = (idx: number, field: 'description' | 'time' | 'timeSeconds', value: string) => {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setSteps(updated);
  };

  const handleSave = async () => {
    if (!id || !originalRecipe) return;
    if (!title.trim()) return Alert.alert('알림', '레시피 이름을 입력해주세요');
    if (!time.trim() && !timeSeconds.trim()) return Alert.alert('알림', '조리 시간을 입력해주세요');
    const validIngredients = ingredients.filter(i => i.name.trim());
    if (validIngredients.length === 0) return Alert.alert('알림', '재료를 최소 1개 입력해주세요');
    const validSteps = steps.filter(s => s.description.trim());
    if (validSteps.length === 0) return Alert.alert('알림', '조리 단계를 최소 1개 입력해주세요');

    setSaving(true);
    const totalMinutes = (parseInt(time) || 0) + Math.round((parseInt(timeSeconds) || 0) / 60);

    // 메인/단계별 로컬 사진은 Firebase Storage로 업로드 후 URL 확보.
    // 실패 시 로컬 file:// URI를 저장하면 다른 기기에서 열었을 때 깨지므로 중단.
    const uploaderUid = (originalRecipe as any)?.authorUid || 'admin';
    let uploadedMainImage = imageUri;
    let uploadedStepImages: string[] = [];
    try {
      if (imageUri && !imageUri.startsWith('http')) {
        uploadedMainImage = await uploadRecipeImage(uploaderUid, imageUri);
      }
      uploadedStepImages = await Promise.all(
        validSteps.map(async (s) => {
          if (!s.imageUrl) return '';
          if (s.imageUrl.startsWith('http')) return s.imageUrl;
          return await uploadRecipeImage(uploaderUid, s.imageUrl);
        })
      );
    } catch {
      Alert.alert('사진 업로드 실패', '사진 업로드 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
      setSaving(false);
      return;
    }

    try {
      await updateRecipe(id, {
        ...originalRecipe,
        title: title.trim(),
        description: description.trim(),
        category,
        difficulty,
        time: totalMinutes,
        calories: parseInt(calories) || 0,
        servings: servings.trim() || '1',
        image: uploadedMainImage,
        ingredients: validIngredients.map(i => ({ name: i.name.trim(), amount: i.amount.trim(), icon: '' })),
        steps: validSteps.map((s, idx) => ({
          step: idx + 1,
          description: s.description.trim(),
          time: (parseFloat(s.time) || 0) + (parseFloat(s.timeSeconds) || 0) / 60,
          imageUrl: uploadedStepImages[idx] || undefined,
          isAiImage: !!s.isAiImage,
        })),
      });
      Alert.alert('완료', '레시피가 수정되었어요!', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('오류', '레시피 수정에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* 스크롤과 무관하게 항상 보이는 뒤로가기 — 레시피 상세 페이지 패턴 */}
      <SafeAreaView style={styles.imageOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.overlayBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </SafeAreaView>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          {/* Hero Image */}
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage} activeOpacity={0.85}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.heroImage} cachePolicy="disk" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Text style={styles.placeholderIcon}>📷</Text>
                <Text style={styles.placeholderText}>사진을 변경하려면 탭하세요</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.content}>
            <TextInput
              style={styles.titleInput}
              placeholder="레시피 이름"
              placeholderTextColor="#BDBDBD"
              value={title}
              onChangeText={setTitle}
              maxLength={20}
            />

            {/* Author Row */}
            <View style={styles.authorRow}>
              {userProfile?.profileImage && userProfile.profileImage !== 'default' && userProfile.profileImage.startsWith('http') ? (
                <Image source={{ uri: userProfile.profileImage }} style={styles.authorAvatar} cachePolicy="disk" />
              ) : (
                <Image source={userProfile?.gender === 'female' ? require('../../assets/girl.png') : require('../../assets/man.png')} style={styles.authorAvatar as any} />
              )}
              <Text style={styles.author}>{userProfile?.nickname || '닉네임'}</Text>
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
              <Text style={styles.sectionTitle}>소개</Text>
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
                <Text style={styles.sectionTitle}>재료</Text>
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
                  <TextInput
                    style={styles.ingredientNameInput}
                    placeholder="재료명"
                    placeholderTextColor="#BDBDBD"
                    value={ing.name}
                    onChangeText={(v) => updateIngredientField(idx, 'name', v)}
                  />
                  <TextInput
                    style={styles.ingredientAmountInput}
                    placeholder="양"
                    placeholderTextColor="#BDBDBD"
                    value={ing.amount}
                    onChangeText={(v) => updateIngredientField(idx, 'amount', v)}
                  />
                </TouchableOpacity>
              ))}
              <Text style={styles.hintText}>길게 눌러서 재료 삭제</Text>
            </View>

            {/* Steps */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>조리 단계</Text>
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
                    {s.imageUrl ? (
                      <TouchableOpacity onPress={() => pickStepImage(idx)} activeOpacity={0.7}>
                        <Image source={{ uri: s.imageUrl }} style={styles.stepThumb} cachePolicy="disk" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.stepAddImageBtn} onPress={() => pickStepImage(idx)}>
                        <Ionicons name="camera-outline" size={16} color="#999" />
                        <Text style={styles.stepAddImageText}>사진 추가</Text>
                      </TouchableOpacity>
                    )}
                    <TextInput
                      style={styles.stepDescInput}
                      placeholder={`${idx + 1}단계를 설명해주세요`}
                      placeholderTextColor="#BDBDBD"
                      value={s.description}
                      onChangeText={(v) => updateStepField(idx, 'description', v)}
                      multiline
                    />
                    <View style={styles.stepTimeRow}>
                      <Ionicons name="time-outline" size={14} color="#1A1A1A" />
                      <TextInput
                        style={[styles.stepTimeInput, { marginLeft: 4 }]}
                        placeholder="0"
                        placeholderTextColor="#BDBDBD"
                        value={s.time}
                        onChangeText={(v) => updateStepField(idx, 'time', v)}
                        keyboardType="numeric"
                      />
                      <Text style={styles.stepTimeUnit}>분</Text>
                      <TextInput
                        style={[styles.stepTimeInput, { marginLeft: 4 }]}
                        placeholder="0"
                        placeholderTextColor="#BDBDBD"
                        value={s.timeSeconds}
                        onChangeText={(v) => updateStepField(idx, 'timeSeconds', v)}
                        keyboardType="numeric"
                      />
                      <Text style={styles.stepTimeUnit}>초</Text>
                      <TouchableOpacity
                        style={styles.stepAiCheckRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          const updated = [...steps];
                          updated[idx] = { ...updated[idx], isAiImage: !updated[idx].isAiImage };
                          setSteps(updated);
                        }}
                      >
                        <View style={[styles.aiCheckbox, s.isAiImage && styles.aiCheckboxOn]}>
                          {s.isAiImage && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                        </View>
                        <Text style={styles.stepAiCheckLabel}>AI 사진</Text>
                      </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.ctaButton, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Text style={styles.ctaText}>{saving ? '저장 중...' : '수정 완료'}</Text>
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
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
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
  stepAiCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 5,
  },
  stepAiCheckLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  aiCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#BDBDBD',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiCheckboxOn: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  // content의 paddingHorizontal: 24를 negate하여 화면 끝까지 스크롤 영역 확장.
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
  ingredientNameInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
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
  stepTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
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
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
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
});
