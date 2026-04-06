import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { fetchRecipeById, updateRecipe } from '../../services/api';
import type { Recipe } from '../../constants/recipes';
import { useAuth } from '../_layout';

const { width } = Dimensions.get('window');
const CATEGORIES = ['아침', '점심', '저녁', '디저트', '간식', '음료'];
const DIFFICULTIES = ['쉬움', '보통', '어려움'];

export default function EditRecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { firebaseUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('점심');
  const [difficulty, setDifficulty] = useState('보통');
  const [time, setTime] = useState('');
  const [timeSeconds, setTimeSeconds] = useState('');
  const [calories, setCalories] = useState('');
  const [imageUri, setImageUri] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', amount: '' }]);
  const [steps, setSteps] = useState([{ description: '', time: '', timeSeconds: '' }]);
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
        setTime(String(Math.floor(recipe.time / 60)));
        setTimeSeconds(String(recipe.time % 60));
        setCalories(String(recipe.calories || 0));
        setImageUri(recipe.image || '');
        if (recipe.ingredients?.length) {
          setIngredients(recipe.ingredients.map(i => ({ name: i.name, amount: i.amount })));
        }
        if (recipe.steps?.length) {
          setSteps(recipe.steps.map(s => ({ description: s.description, time: String(Math.floor((s.time || 0) / 60)), timeSeconds: String((s.time || 0) % 60) })));
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

  const addStep = () => setSteps([...steps, { description: '', time: '', timeSeconds: '' }]);
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
    try {
      await updateRecipe(id, {
        ...originalRecipe,
        title: title.trim(),
        description: description.trim(),
        category,
        difficulty,
        time: (parseInt(time) || 0) * 60 + (parseInt(timeSeconds) || 0),
        calories: parseInt(calories) || 0,
        image: imageUri,
        ingredients: validIngredients.map(i => ({ name: i.name.trim(), amount: i.amount.trim(), icon: '' })),
        steps: validSteps.map((s, idx) => ({
          step: idx + 1,
          description: s.description.trim(),
          time: (parseFloat(s.time) || 0) * 60 + (parseFloat(s.timeSeconds) || 0),
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
        <ActivityIndicator size="large" color="#0B9A61" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
          {/* Hero Image */}
          <TouchableOpacity style={styles.imageContainer} onPress={pickImage} activeOpacity={0.85}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.heroImage} />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Text style={styles.placeholderIcon}>📷</Text>
                <Text style={styles.placeholderText}>사진을 변경하려면 탭하세요</Text>
              </View>
            )}
            <SafeAreaView style={styles.imageOverlay}>
              <TouchableOpacity style={styles.overlayBtn} onPress={() => router.back()}>
                <Text style={styles.overlayBtnIcon}>←</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </TouchableOpacity>

          {/* Content */}
          <View style={styles.content}>
            <TextInput
              style={styles.titleInput}
              placeholder="레시피 이름"
              placeholderTextColor="#BDBDBD"
              value={title}
              onChangeText={setTitle}
            />

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
                    <TextInput
                      style={styles.stepDescInput}
                      placeholder={`${idx + 1}단계를 설명해주세요`}
                      placeholderTextColor="#BDBDBD"
                      value={s.description}
                      onChangeText={(v) => updateStepField(idx, 'description', v)}
                      multiline
                    />
                    <View style={styles.stepTimeRow}>
                      <Text style={styles.stepTimeIcon}>◷</Text>
                      <TextInput
                        style={styles.stepTimeInput}
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
    height: width * 0.85,
    position: 'relative',
  },
  heroImage: {
    width: width,
    height: width * 0.85,
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
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
  ingredientNameInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    paddingVertical: 0,
  },
  ingredientAmountInput: {
    fontSize: 14,
    color: '#0B9A61',
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 60,
    paddingVertical: 0,
  },
  hintText: {
    fontSize: 11,
    color: '#BDBDBD',
    marginTop: 8,
    textAlign: 'center',
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0B9A61',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepDescInput: {
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
    paddingVertical: 0,
  },
  stepTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stepTimeIcon: {
    fontSize: 14,
    color: '#0B9A61',
    marginRight: 4,
  },
  stepTimeInput: {
    fontSize: 13,
    color: '#666',
    paddingVertical: 0,
    minWidth: 20,
    textAlign: 'center',
  },
  stepTimeUnit: {
    fontSize: 13,
    color: '#666',
    marginLeft: 2,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  ctaButton: {
    backgroundColor: '#0B9A61',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
