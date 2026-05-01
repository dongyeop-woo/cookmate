import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../_layout';
import { createInquiry, uploadRecipeImage } from '../../services/api';

const CATEGORIES = ['일반', '계정', '결제', '신고', '제안', '기타'];

// 이벤트 응모 모드일 때 미리 채워둘 값. 사용자는 인증 사진만 첨부하고 제출만 누르면 됨.
const EVENT_REVIEW_PREFILL = {
  category: '기타',
  title: '[이벤트] 앱 리뷰 인증',
  content: '요잘알 앱 리뷰 이벤트에 응모합니다.',
};

export default function InquiryWriteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isEventMode = params.mode === 'event';
  const { firebaseUser, userProfile } = useAuth();
  const [category, setCategory] = useState(isEventMode ? EVENT_REVIEW_PREFILL.category : '일반');
  // 이벤트 모드: 진입 시점 닉네임 있으면 같이 prefill — 응모자 식별용.
  const [title, setTitle] = useState(() => {
    if (!isEventMode) return '';
    const nick = userProfile?.nickname;
    return nick ? `${EVENT_REVIEW_PREFILL.title} - ${nick}` : EVENT_REVIEW_PREFILL.title;
  });
  const [content, setContent] = useState(isEventMode ? EVENT_REVIEW_PREFILL.content : '');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 닉네임이 늦게 로드될 수 있어 — 사용자가 제목을 손대지 않은 경우만 보강.
  useEffect(() => {
    if (!isEventMode) return;
    const nick = userProfile?.nickname;
    if (!nick) return;
    if (title === EVENT_REVIEW_PREFILL.title) {
      setTitle(`${EVENT_REVIEW_PREFILL.title} - ${nick}`);
    }
  }, [isEventMode, userProfile?.nickname, title]);

  const pickImage = async () => {
    if (images.length >= 2) {
      Alert.alert('안내', '이미지는 최대 2장까지 첨부할 수 있어요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 2 - images.length,
    });
    if (!result.canceled) {
      const newImages = result.assets.map(a => a.uri).slice(0, 2 - images.length);
      setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!firebaseUser?.uid) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('제목 입력', '문의 제목을 입력해주세요.');
      return;
    }
    if (content.trim().length < 5) {
      Alert.alert('문의 내용', '문의 내용은 5자 이상 작성해주세요.');
      return;
    }
    if (isEventMode && images.length === 0) {
      Alert.alert('인증 사진 필요', '스토어 리뷰 캡처 사진을 1장 이상 첨부해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedImages: string[] = [];
      if (images.length > 0) {
        uploadedImages = await Promise.all(
          images.map(uri => uploadRecipeImage(firebaseUser.uid, uri))
        );
      }
      await createInquiry({
        uid: firebaseUser.uid,
        authorNickname: userProfile?.nickname,
        authorEmail: userProfile?.email,
        category,
        title: title.trim(),
        content: content.trim(),
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });
      Alert.alert('문의 접수 완료', '답변이 등록되면 알림으로 안내드릴게요.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('등록 실패', e.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEventMode ? '이벤트 응모' : '문의 작성'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'android' ? 80 : 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {isEventMode && (
            <View style={styles.eventBanner}>
              <Ionicons name="gift-outline" size={18} color="#07704A" />
              <Text style={styles.eventBannerText}>
                스토어 리뷰 캡처를 첨부해 주시면{"\n"}이벤트 응모가 완료됩니다.
              </Text>
            </View>
          )}

          <Text style={styles.label}>분류</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.categoryBtn, category === c && styles.categoryBtnActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.categoryBtnText, category === c && styles.categoryBtnTextActive]}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>제목 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="문의 제목을 입력해주세요"
            placeholderTextColor="#AAA"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />

          <Text style={styles.label}>내용 <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.textarea}
            placeholder="문의 내용을 자세히 입력해주세요 (5자 이상)"
            placeholderTextColor="#AAA"
            multiline
            textAlignVertical="top"
            value={content}
            onChangeText={setContent}
            maxLength={1000}
          />
          <Text style={styles.charCount}>{content.length} / 1000</Text>

          <Text style={[styles.label, { marginTop: 16 }]}>
            {isEventMode ? '리뷰 캡처' : '이미지 첨부'}{' '}
            <Text style={{ color: isEventMode ? '#FF3B30' : '#999', fontWeight: '400', fontSize: 12 }}>
              {isEventMode ? '(필수, 최대 2장)' : '(선택, 최대 2장)'}
            </Text>
          </Text>
          <View style={styles.imageRow}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imageThumbWrap}>
                <Image source={{ uri }} style={styles.imageThumb} contentFit="cover" />
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => removeImage(idx)}>
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 2 && (
              <TouchableOpacity style={styles.imageAddBtn} onPress={pickImage}>
                <Ionicons name="camera-outline" size={24} color="#999" />
                <Text style={styles.imageAddText}>{images.length}/2</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              • 답변은 영업일 기준 1~3일 내 등록됩니다{'\n'}
              • 답변 등록 시 알림으로 안내드려요{'\n'}
              • 신고 관련 문의는 최대한 자세히 작성해주세요
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>문의 등록하기</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#E8F5EF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  eventBannerText: {
    flex: 1,
    color: '#07704A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },

  label: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginTop: 16, marginBottom: 8 },
  required: { color: '#FF3B30' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
  },
  categoryBtnActive: { backgroundColor: '#1A1A1A' },
  categoryBtnText: { fontSize: 13, color: '#666', fontWeight: '600' },
  categoryBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1A',
  },
  textarea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#1A1A1A',
  },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 4 },

  notice: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 16,
  },
  noticeText: { fontSize: 12, color: '#666', lineHeight: 18 },

  imageRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  imageThumbWrap: { position: 'relative' },
  imageThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#F5F5F5' },
  imageRemoveBtn: { position: 'absolute', top: -6, right: -6 },
  imageAddBtn: {
    width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#E0E0E0',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  imageAddText: { fontSize: 11, color: '#999' },

  submitBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: { backgroundColor: '#BDBDBD' },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
