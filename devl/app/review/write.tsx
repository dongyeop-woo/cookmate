import React, { useState, useRef } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../_layout';
import { createReview, uploadReviewImage, updateReview } from '../../services/api';

export default function ReviewWriteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipeId: string;
    recipeTitle?: string;
    reviewId?: string;
    initialContent?: string;
    initialRating?: string;
    initialPhotoUrl?: string;
  }>();
  const { recipeId, recipeTitle, reviewId } = params;
  const isEditMode = !!reviewId;
  const { firebaseUser, userProfile } = useAuth();

  const [photoUri, setPhotoUri] = useState<string | null>(params.initialPhotoUrl || null);
  const [content, setContent] = useState(params.initialContent || '');
  const [rating, setRating] = useState(params.initialRating ? Number(params.initialRating) : 0);
  const [submitting, setSubmitting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const contentFieldYRef = useRef(0);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!firebaseUser?.uid) {
      Alert.alert('로그인 필요', '로그인 후 이용해주세요.');
      return;
    }
    const trimmed = content.trim();
    if (rating === 0 && trimmed.length === 0) {
      Alert.alert('후기 작성', '별점을 남기거나 후기 내용을 작성해주세요.');
      return;
    }
    if (trimmed.length > 0 && trimmed.length < 10) {
      Alert.alert('후기 작성', '후기 내용은 10자 이상 작성하거나 비워주세요.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode) {
        // 수정 모드: 광고/포인트 없이 업데이트만
        let newPhotoUrl: string | undefined;
        if (photoUri) {
          newPhotoUrl = photoUri.startsWith('http')
            ? photoUri
            : await uploadReviewImage(firebaseUser.uid, photoUri);
        }
        await updateReview(reviewId as string, firebaseUser.uid, {
          content: content.trim(),
          photoUrl: newPhotoUrl,
          rating: rating > 0 ? rating : undefined,
        });
        Alert.alert('수정 완료', '후기가 수정되었어요.', [
          { text: '확인', onPress: () => router.back() },
        ]);
      } else {
        const photoUrl = photoUri ? await uploadReviewImage(firebaseUser.uid, photoUri) : undefined;
        const review = await createReview({
          recipeId: recipeId as string,
          uid: firebaseUser.uid,
          authorNickname: userProfile?.nickname,
          authorProfileImage: userProfile?.profileImage,
          photoUrl,
          content: content.trim(),
          rating: rating > 0 ? rating : undefined,
        });
        if (review.pointAwarded > 0) {
          Alert.alert('후기 등록 완료!', `${review.pointAwarded}P가 적립되었어요.`, [
            { text: '확인', onPress: () => router.back() },
          ]);
        } else {
          const reasonMsg = (() => {
            switch (review.pointDenyReason) {
              case 'OWN_RECIPE': return '본인이 작성한 레시피에는 포인트가 적립되지 않아요.';
              case 'ALREADY_REVIEWED': return '이미 이 레시피에 후기를 작성해 포인트가 적립되지 않았어요.';
              case 'PAST_EARN': return '이전에 이 레시피로 후기 포인트를 받은 적이 있어요.';
              case 'DAILY_LIMIT': return '오늘 후기 작성 한도(5개)를 모두 사용했어요.';
              default: return '포인트 지급 조건을 충족하지 않아 적립되지 않았어요.';
            }
          })();
          Alert.alert('후기 등록 완료', `후기가 등록되었어요.\n\n${reasonMsg}`, [
            { text: '확인', onPress: () => router.back() },
          ]);
        }
      }
    } catch (e: any) {
      Alert.alert(isEditMode ? '수정 실패' : '등록 실패', e.message || '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? '후기 수정' : '후기 작성'}</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      >
        <Text style={styles.label}>완성 사진 <Text style={styles.optional}>(선택)</Text></Text>
        <Text style={styles.hint}>별점·텍스트 +10P · 사진 첨부 시 +20P</Text>

        {photoUri ? (
          <View style={styles.photoWrapper}>
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotoUri(null)}>
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={22} color="#1A1A1A" />
              <Text style={styles.photoBtnText}>카메라</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={22} color="#1A1A1A" />
              <Text style={styles.photoBtnText}>갤러리</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.label}>별점</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setRating(n === rating ? 0 : n)}>
              <Ionicons
                name={n <= rating ? 'star' : 'star-outline'}
                size={32}
                color={n <= rating ? '#FFB800' : '#D0D0D0'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View
          onLayout={(e) => { contentFieldYRef.current = e.nativeEvent.layout.y; }}
          style={{ marginTop: 16 }}
        />
        <TextInput
          style={styles.textarea}
          placeholder="요리하면서 느낀 점, 팁, 아쉬운 점 등을 자유롭게 적어주세요 (10자 이상)"
          placeholderTextColor="#AAA"
          multiline
          textAlignVertical="top"
          value={content}
          onChangeText={setContent}
          maxLength={500}
          onFocus={() => {
            setTimeout(() => {
              scrollRef.current?.scrollTo({ y: Math.max(0, contentFieldYRef.current - 20), animated: true });
            }, 300);
          }}
        />
        <Text style={styles.charCount}>{content.length} / 500</Text>

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{isEditMode ? '수정 완료' : '후기 등록하기'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  backBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  recipeTitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginTop: 16, marginBottom: 6 },
  required: { color: '#FF3B30' },
  optional: { color: '#999', fontWeight: '500' },
  hint: { fontSize: 12, color: '#888', marginBottom: 10 },
  photoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  photo: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButtons: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#1A1A1A',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  ratingRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#1A1A1A',
  },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 4 },
  submitBtn: {
    backgroundColor: '#1BAE74',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#BDBDBD' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
