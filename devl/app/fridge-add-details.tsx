import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addFridgeItem,
  findDuplicate,
  getFridge,
  type StorageType,
} from '../services/fridge';
import { rebuildExpiryNotifications } from '../services/fridgeNotifications';
import { loadFridgeSettings } from '../services/fridgeSettings';
import {
  guessIconFromProduct,
  inferStorage,
  type HaccpProduct,
} from '../services/haccp';
import { uploadRecipeImage } from '../services/api';
import { authInstance } from '../firebase';

const ACCENT = '#007AFF';
const TEXT = '#1A1A1A';
const SUBTEXT = '#8E8E93';
const BORDER = '#ECECEC';
const SURFACE = '#F5F5F7';

const QUICK_EXPIRY: { label: string; days: number }[] = [
  { label: '오늘', days: 0 },
  { label: '3일', days: 3 },
  { label: '1주', days: 7 },
  { label: '2주', days: 14 },
  { label: '1개월', days: 30 },
];

export default function FridgeAddDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    prdlstReportNo?: string;
    prdlstNm?: string;
    prdkind?: string;
    prdkindState?: string;
    capacity?: string;
    imgurl1?: string;
  }>();

  const selectedProduct = useMemo<HaccpProduct | null>(() => {
    if (!params.prdlstNm) return null;
    return {
      prdlstReportNo: params.prdlstReportNo ?? '',
      prdlstNm: params.prdlstNm ?? '',
      manufacture: '',
      seller: '',
      prdkind: params.prdkind ?? '',
      prdkindState: params.prdkindState ?? '',
      capacity: params.capacity ?? '',
      rawmtrl: '',
      allergy: '',
      nutrient: '',
      barcode: '',
      imgurl1: params.imgurl1 ?? '',
      imgurl2: '',
    };
  }, [params.prdlstReportNo, params.prdlstNm, params.prdkind, params.prdkindState, params.capacity, params.imgurl1]);

  // API에서 온 제품(HACCP/식약처)은 이미지 수정 불가 — curated(common:) 또는 선택 전 상태에서만 편집 허용
  const isCustomIngredient = !selectedProduct?.prdlstReportNo || selectedProduct.prdlstReportNo.startsWith('common:');

  const [name, setName] = useState(selectedProduct?.prdlstNm ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(selectedProduct?.imgurl1 || null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fallbackIcon] = useState(selectedProduct ? guessIconFromProduct(selectedProduct) : '🧊');
  const [quantity, setQuantity] = useState(selectedProduct?.capacity ?? '');
  const [storage, setStorage] = useState<StorageType>(
    selectedProduct ? inferStorage(selectedProduct.prdkindState) : 'fridge'
  );
  const [expiresAt, setExpiresAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [customDays, setCustomDays] = useState('');
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    if (uploadingImage) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('unregistered ActivityResultLauncher')) {
        Alert.alert(
          '잠시 후 다시 시도해주세요',
          '사진 선택기를 여는 중 오류가 발생했어요. 화면을 한 번 닫았다가 다시 열면 정상 동작합니다.'
        );
      } else {
        Alert.alert('사진 선택 실패', msg || '다시 시도해주세요');
      }
      return;
    }
    if (result.canceled || result.assets.length === 0) return;
    const uri = result.assets[0].uri;
    setUploadingImage(true);
    try {
      const uid = authInstance.currentUser?.uid ?? 'guest';
      const url = await uploadRecipeImage(uid, uri);
      setImageUrl(url);
    } catch (e: any) {
      Alert.alert('업로드 실패', e?.message || '다시 시도해주세요');
    } finally {
      setUploadingImage(false);
    }
  };

  const quickExpiry = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 0, 0);
    setExpiresAt(d);
  };

  const daysRemaining = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expiresAt);
    exp.setHours(0, 0, 0, 0);
    return Math.round((exp.getTime() - now.getTime()) / 86400000);
  }, [expiresAt]);

  const expiryLabel = useMemo(() => {
    const exp = new Date(expiresAt);
    return `${exp.getFullYear()}.${String(exp.getMonth() + 1).padStart(2, '0')}.${String(exp.getDate()).padStart(2, '0')}`;
  }, [expiresAt]);

  const activeQuickDays = useMemo(() => {
    return QUICK_EXPIRY.find(q => q.days === daysRemaining)?.days ?? null;
  }, [daysRemaining]);

  const doSave = async () => {
    const trimmed = name.trim();
    setSaving(true);
    try {
      await addFridgeItem({
        name: trimmed,
        icon: fallbackIcon,
        imageUrl: imageUrl || undefined,
        quantity: quantity.trim() || undefined,
        expiresAt: expiresAt.toISOString(),
        storage,
        isCustom: isCustomIngredient,
        sourceKey: selectedProduct?.prdlstReportNo || undefined,
      });
      try {
        const [fridgeList, settings] = await Promise.all([getFridge(), loadFridgeSettings()]);
        await rebuildExpiryNotifications(fridgeList, settings);
      } catch {}
      router.back();
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message || '다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('알림', '재료 이름을 입력해주세요');
      return;
    }
    const dup = await findDuplicate(trimmed);
    if (dup) {
      Alert.alert(
        '이미 있는 재료',
        `'${dup.name}'${dup.quantity ? ` (${dup.quantity})` : ''}이(가) 이미 냉장고에 있어요.\n그래도 추가할까요?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '추가', onPress: doSave },
        ]
      );
      return;
    }
    doSave();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>상세 정보</Text>
        </View>
        <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()} hitSlop={10}>
          <Text style={[
            styles.headerAction,
            (!name.trim() || saving) && { color: '#B4B4B8' },
          ]}>
            {saving ? '저장 중' : '저장'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.productPreview}>
            {isCustomIngredient ? (
              <TouchableOpacity style={styles.productImageWrap} onPress={pickImage} activeOpacity={0.85}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.productImage} contentFit="cover" />
                ) : (
                  <View style={styles.productImageFallback}>
                    <Ionicons name="image-outline" size={36} color="#C4C4C4" />
                  </View>
                )}
                {uploadingImage && (
                  <View style={styles.productImageOverlay}>
                    <ActivityIndicator color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.productImageEditBadge}>
                  <Ionicons name="camera" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.productImageWrap}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.productImage} contentFit="cover" />
                ) : (
                  <View style={styles.productImageFallback}>
                    <Text style={{ fontSize: 48 }}>{fallbackIcon}</Text>
                  </View>
                )}
              </View>
            )}
            {selectedProduct?.prdkind ? (
              <Text style={styles.productKind}>{selectedProduct.prdkind}</Text>
            ) : null}
          </View>

          <FieldRow label="이름">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="재료 이름"
              placeholderTextColor="#BDBDBD"
              style={styles.fieldInput}
              maxLength={40}
            />
          </FieldRow>

          <FieldRow label="수량" optional>
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              placeholder="예: 1L, 2개, 500g"
              placeholderTextColor="#BDBDBD"
              style={styles.fieldInput}
              maxLength={20}
            />
          </FieldRow>

          <FieldRow label="보관 위치">
            <View style={styles.segmentRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, storage === 'fridge' && styles.segmentBtnActive]}
                onPress={() => setStorage('fridge')}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, storage === 'fridge' && styles.segmentTextActive]}>
                  냉장실
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentBtn, storage === 'freezer' && styles.segmentBtnActive]}
                onPress={() => setStorage('freezer')}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, storage === 'freezer' && styles.segmentTextActive]}>
                  냉동실
                </Text>
              </TouchableOpacity>
            </View>
          </FieldRow>

          <FieldRow label="유효기간">
            <View style={styles.chipRow}>
              {QUICK_EXPIRY.map(q => {
                const active = activeQuickDays === q.days;
                return (
                  <TouchableOpacity
                    key={q.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { quickExpiry(q.days); setCustomDays(''); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{q.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.customRow}>
              <Text style={styles.customLabel}>직접 입력</Text>
              <TextInput
                value={customDays}
                onChangeText={(v) => {
                  const clean = v.replace(/[^0-9]/g, '').slice(0, 3);
                  setCustomDays(clean);
                  if (clean) {
                    const n = parseInt(clean, 10);
                    if (!isNaN(n) && n >= 0) quickExpiry(n);
                  }
                }}
                placeholder="0"
                placeholderTextColor="#BDBDBD"
                keyboardType="number-pad"
                style={styles.customInput}
                maxLength={3}
              />
              <Text style={styles.customLabel}>일 후</Text>
              <Text style={styles.customDate}>
                ({expiryLabel})
              </Text>
            </View>
          </FieldRow>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FieldRow({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {optional ? <Text style={styles.fieldOptional}>선택</Text> : null}
      </View>
      {children}
    </View>
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT,
  },
  headerAction: { fontSize: 16, color: '#1BAE74', fontWeight: '700' },

  productPreview: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  productImageWrap: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: SURFACE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: { width: '100%', height: '100%' },
  productImageFallback: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImageEditBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TEXT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productKind: {
    marginTop: 10,
    fontSize: 12,
    color: SUBTEXT,
    fontWeight: '500',
  },

  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: SUBTEXT,
    fontWeight: '600',
  },
  fieldOptional: {
    fontSize: 11,
    color: '#B4B4B8',
    fontWeight: '500',
  },
  fieldInput: {
    fontSize: 16,
    color: TEXT,
    paddingVertical: 6,
  },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    color: SUBTEXT,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: TEXT,
    fontWeight: '700',
  },

  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SURFACE,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: TEXT,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#5A5A5F' },
  chipTextActive: { color: '#FFFFFF' },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  customLabel: { fontSize: 13, color: SUBTEXT, fontWeight: '500' },
  customInput: {
    width: 52,
    paddingVertical: 4,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    borderBottomWidth: 1.5,
    borderBottomColor: TEXT,
  },
  customDate: {
    fontSize: 12,
    color: '#B4B4B8',
    marginLeft: 'auto',
  },
});
