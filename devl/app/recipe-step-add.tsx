import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const TEXT = '#1A1A1A';
const SUBTEXT = '#8E8E93';
const BORDER = '#ECECEC';

export const RECIPE_STEP_PICKED = 'recipe:stepPicked';

export default function RecipeStepAddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    index?: string;
    description?: string;
    time?: string;
    timeSeconds?: string;
    imageUrl?: string;
    isAiImage?: string;
  }>();
  const targetIndex = params.index !== undefined ? Number(params.index) : -1;

  const [description, setDescription] = useState(params.description ?? '');
  const [time, setTime] = useState(params.time ?? '');
  const [timeSeconds, setTimeSeconds] = useState(params.timeSeconds ?? '');
  const [imageUri, setImageUri] = useState(params.imageUrl ?? '');
  const [isAiImage, setIsAiImage] = useState(params.isAiImage === 'true');

  const canSubmit = description.trim().length > 0;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      // 업로드 용량 절감 — 클라이언트에서 리사이즈 (폭 최대 1200px)
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleConfirm = () => {
    if (!canSubmit) return;
    DeviceEventEmitter.emit(RECIPE_STEP_PICKED, {
      index: targetIndex,
      description: description.trim(),
      time: time.trim(),
      timeSeconds: timeSeconds.trim(),
      imageUrl: imageUri, // 로컬 파일 URI 또는 원격 URL. write/edit에서 업로드 처리
      isAiImage,
    });
    router.back();
  };

  const isEdit = targetIndex >= 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={TEXT} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>{isEdit ? '단계 수정' : '단계 추가'}</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.fieldLabel}>설명</Text>
          <TextInput
            style={[styles.field, styles.descField]}
            value={description}
            onChangeText={setDescription}
            placeholder="이 단계를 자세히 설명해주세요"
            placeholderTextColor="#BDBDBD"
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.hint}>{description.length}/500</Text>

          <Text style={[styles.fieldLabel, { marginTop: 24 }]}>단계 사진 (선택)</Text>
          {imageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
              <View style={styles.imageActions}>
                <TouchableOpacity style={styles.imageActionBtn} onPress={pickImage}>
                  <Ionicons name="image-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.imageActionText}>변경</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageActionBtn} onPress={() => setImageUri('')}>
                  <Ionicons name="close" size={16} color="#E74C3C" />
                  <Text style={[styles.imageActionText, { color: '#E74C3C' }]}>삭제</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.imageAddBtn} onPress={pickImage}>
              <Ionicons name="camera-outline" size={20} color={SUBTEXT} />
              <Text style={styles.imageAddText}>사진 추가하기</Text>
            </TouchableOpacity>
          )}

          {imageUri ? (
            <TouchableOpacity
              style={styles.aiToggleRow}
              activeOpacity={0.7}
              onPress={() => setIsAiImage(!isAiImage)}
            >
              <View style={[styles.aiCheckbox, isAiImage && styles.aiCheckboxOn]}>
                {isAiImage && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
              </View>
              <Text style={styles.aiToggleLabel}>AI 사진</Text>
              <Text style={styles.aiToggleHint}>체크하면 사진 위에 'AI로 생성된 참고 이미지' 라벨이 표시돼요</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={[styles.fieldLabel, { marginTop: 24 }]}>조리 시간 (선택)</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeCell}>
              <Ionicons name="time-outline" size={16} color={SUBTEXT} />
              <TextInput
                style={styles.timeInput}
                value={time}
                onChangeText={(v) => setTime(v.replace(/[^0-9]/g, '').slice(0, 3))}
                placeholder="0"
                placeholderTextColor="#BDBDBD"
                keyboardType="number-pad"
              />
              <Text style={styles.timeUnit}>분</Text>
            </View>
            <View style={styles.timeCell}>
              <TextInput
                style={styles.timeInput}
                value={timeSeconds}
                onChangeText={(v) => setTimeSeconds(v.replace(/[^0-9]/g, '').slice(0, 2))}
                placeholder="0"
                placeholderTextColor="#BDBDBD"
                keyboardType="number-pad"
              />
              <Text style={styles.timeUnit}>초</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.confirmBtn, !canSubmit && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!canSubmit}
          >
            <Text style={styles.confirmText}>{isEdit ? '단계 수정' : '단계 추가'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT },
  fieldLabel: { fontSize: 13, color: SUBTEXT, fontWeight: '600', marginBottom: 8 },
  field: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: TEXT,
  },
  descField: { minHeight: 160 },
  hint: { fontSize: 12, color: SUBTEXT, textAlign: 'right', marginTop: 6 },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeCell: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  timeInput: {
    flex: 1, fontSize: 15, color: TEXT, padding: 0,
  },
  timeUnit: { fontSize: 14, color: TEXT, fontWeight: '600' },
  bottomBar: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: '#FFFFFF',
  },
  confirmBtn: {
    backgroundColor: '#1BAE74', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#BDBDBD' },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  imageAddBtn: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 24, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
    backgroundColor: '#FAFAFA',
  },
  imageAddText: { fontSize: 14, color: SUBTEXT, fontWeight: '500' },
  imagePreviewWrap: {
    borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER,
  },
  imagePreview: {
    width: '100%', aspectRatio: 16 / 10,
    backgroundColor: '#F0F0F0',
  },
  imageActions: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  imageActionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
  },
  imageActionText: { fontSize: 14, color: '#1A1A1A', fontWeight: '600' },
  aiToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 4, marginTop: 8,
  },
  aiCheckbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#BDBDBD',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  aiCheckboxOn: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  aiToggleLabel: { fontSize: 13, fontWeight: '600', color: TEXT },
  aiToggleHint: { flex: 1, fontSize: 11, color: SUBTEXT, marginLeft: 4 },
});
