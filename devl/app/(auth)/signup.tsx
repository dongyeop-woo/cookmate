import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  ActionSheetIOS,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { consumePendingTermAgreement } from '../../constants/termsAgreementState';
import { updateProfile } from 'firebase/auth';
import { authInstance } from '../../firebase';
import { useAuth } from '../_layout';
import { createUser, checkNicknameAvailable } from '../../services/api';

const STEPS = [
  { key: 'terms', title: '이용약관' },
  { key: 'nickname', title: '프로필 설정' },
] as const;

const TERMS = [
  { id: 'all', label: '전체 동의', required: false, isAll: true },
  { id: 'service', label: '[필수] 서비스 이용약관 동의', required: true },
  { id: 'privacy', label: '[필수] 개인정보 처리방침 동의', required: true },
  { id: 'marketing', label: '[선택] 마케팅 정보 수신 동의', required: false },
];

export default function SignupScreen() {
  const router = useRouter();
  const { firebaseUser, setIsLoggedIn, setUserProfile } = useAuth();
  const [step, setStep] = useState(0);

  // Step 0: Terms
  const [agreedTerms, setAgreedTerms] = useState<Record<string, boolean>>({});

  // Step 1: Nickname, Bio, Gender & Profile Photo
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('male');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const nicknameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requiredTermsIds = TERMS.filter(t => t.required).map(t => t.id);
  const allNonAllIds = TERMS.filter(t => !t.isAll).map(t => t.id);
  const allTermsAgreed = requiredTermsIds.every(id => agreedTerms[id]);

  const handleNicknameChange = (text: string) => {
    setNickname(text);
    if (nicknameTimer.current) clearTimeout(nicknameTimer.current);
    if (!text.trim()) {
      setNicknameStatus('idle');
      return;
    }
    setNicknameStatus('checking');
    nicknameTimer.current = setTimeout(async () => {
      try {
        const available = await checkNicknameAvailable(text.trim());
        setNicknameStatus(available ? 'available' : 'taken');
      } catch {
        setNicknameStatus('idle');
      }
    }, 500);
  };

  useEffect(() => {
    return () => { if (nicknameTimer.current) clearTimeout(nicknameTimer.current); };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const agreedTerm = consumePendingTermAgreement();
      if (!agreedTerm) return;
      setAgreedTerms(prev => ({ ...prev, [agreedTerm]: true }));
    }, [])
  );

  const toggleTerm = (id: string) => {
    const term = TERMS.find(t => t.id === id);
    if (term?.isAll) {
      const newVal = !allNonAllIds.every(tid => agreedTerms[tid]);
      const next: Record<string, boolean> = {};
      allNonAllIds.forEach(tid => { next[tid] = newVal; });
      setAgreedTerms(next);
    } else {
      setAgreedTerms(prev => ({ ...prev, [id]: !prev[id] }));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '프로필 사진을 선택하려면 갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const resetToDefaultImage = () => {
    setProfileImage('default');
  };

  const showPhotoOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: '프로필 사진 설정',
          options: ['앨범에서 사진 선택', '기본 이미지로 변경', '취소'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) pickImage();
          else if (buttonIndex === 1) resetToDefaultImage();
        },
      );
    } else {
      Alert.alert('프로필 사진 설정', undefined, [
        { text: '앨범에서 사진 선택', onPress: pickImage },
        { text: '기본 이미지로 변경', onPress: resetToDefaultImage },
        { text: '취소', style: 'cancel' },
      ]);
    }
  };

  const handleComplete = async () => {
    if (!firebaseUser) {
      Alert.alert('오류', '로그인 정보가 없습니다. 다시 시도해주세요.');
      router.replace('/(auth)/welcome');
      return;
    }
    setSignupLoading(true);
    const finalNickname = nickname.trim() || firebaseUser.displayName || '요리사';
    try {
      await updateProfile(firebaseUser, { displayName: finalNickname });
      const defaultAvatar = gender === 'male'
        ? Image.resolveAssetSource(require('../../assets/man.png')).uri
        : gender === 'female'
          ? Image.resolveAssetSource(require('../../assets/girl.png')).uri
          : '';
      let finalProfileImage: string;
      if (profileImage && profileImage !== 'default') {
        finalProfileImage = profileImage;
      } else if (profileImage === 'default') {
        finalProfileImage = defaultAvatar;
      } else {
        finalProfileImage = firebaseUser.photoURL || defaultAvatar;
      }
      const profile = await createUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        nickname: finalNickname,
        phone: '',
        profileImage: finalProfileImage,
        bio: bio.trim(),
        gender,
      });
      setUserProfile(profile);
      setIsLoggedIn(true);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert('가입 실패', '프로필 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSignupLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return allTermsAgreed;
      case 1: return gender !== '' && nicknameStatus !== 'taken';
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {STEPS.map((s, i) => (
        <View key={s.key} style={styles.stepItem}>
          <View style={[
            styles.stepDot,
            i <= step && styles.stepDotActive,
            i < step && styles.stepDotDone,
          ]}>
            <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>
              {i < step ? '✓' : i + 1}
            </Text>
          </View>
          <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s.title}</Text>
          {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
        </View>
      ))}
    </View>
  );

  const renderTerms = () => (
    <View>
      <Text style={styles.sectionTitle}>이용약관</Text>
      <Text style={styles.sectionSubtitle}>서비스 이용을 위해 약관에 동의해주세요</Text>

      <View style={styles.termsBox}>
        {TERMS.map((term, idx) => {
          const isAll = term.isAll;
          const checked = isAll
            ? allNonAllIds.every(tid => agreedTerms[tid])
            : !!agreedTerms[term.id];

          return (
            <React.Fragment key={term.id}>
              <TouchableOpacity
                style={[styles.termRow, isAll && styles.termRowAll]}
                onPress={() => toggleTerm(term.id)}
              >
                <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.termText, isAll && styles.termTextAll]}>{term.label}</Text>
                {(term.id === 'service' || term.id === 'privacy') && (
                  <TouchableOpacity
                    onPress={() => router.push({
                      pathname: term.id === 'service' ? '/(auth)/terms-service' : '/(auth)/terms-privacy',
                      params: { from: 'signup' },
                    })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.termDetailLink}>자세히</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {isAll && <View style={styles.termDivider} />}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

  const socialName = firebaseUser?.displayName || '';
  const socialPhoto = firebaseUser?.photoURL || '';

  const getAvatarSource = () => {
    if (profileImage && profileImage !== 'default') return { uri: profileImage };
    if (profileImage !== 'default' && socialPhoto) return { uri: socialPhoto };
    if (gender === 'male') return require('../../assets/man.png');
    if (gender === 'female') return require('../../assets/girl.png');
    return null;
  };

  const renderNickname = () => (
    <View>
      <Text style={styles.sectionTitle}>프로필 설정</Text>
      <Text style={styles.sectionSubtitle}>앱에서 사용할 프로필을 설정하세요</Text>

      <View style={styles.avatarSection}>
        {getAvatarSource() ? (
          <Image source={getAvatarSource()!} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>+</Text>
          </View>
        )}
        <TouchableOpacity style={styles.avatarEditBadge} onPress={showPhotoOptions} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.avatarEditText}>✎</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>닉네임</Text>
        <TextInput
          style={[styles.inputSingle, nicknameStatus === 'taken' && styles.inputError]}
          placeholder={socialName ? `${socialName} (미입력 시 자동 설정)` : '닉네임을 입력하세요'}
          placeholderTextColor="#BDBDBD"
          value={nickname}
          onChangeText={handleNicknameChange}
          maxLength={16}
          autoFocus
        />
        <Text style={styles.charCount}>{nickname.length}/16</Text>
        {nicknameStatus === 'taken' && (
          <Text style={styles.nicknameError}>이미 사용 중인 닉네임입니다</Text>
        )}
        {nicknameStatus === 'available' && (
          <Text style={styles.nicknameAvailable}>사용 가능한 닉네임입니다</Text>
        )}
        {nicknameStatus === 'checking' && (
          <Text style={styles.nicknameChecking}>확인 중...</Text>
        )}
        {socialName ? (
          <Text style={styles.nicknameHint}>입력하지 않으면 소셜 계정 이름({socialName})으로 설정됩니다</Text>
        ) : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>성별</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
            onPress={() => setGender('male')}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderBtnText, gender === 'male' && styles.genderBtnTextActive]}>남자</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
            onPress={() => setGender('female')}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderBtnText, gender === 'female' && styles.genderBtnTextActive]}>여자</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.genderNotice}>가입 후 성별은 변경할 수 없습니다</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>한줄소개 <Text style={styles.optionalBadge}>(선택)</Text></Text>
        <TextInput
          style={styles.inputSingle}
          placeholder="나를 소개하는 한 줄을 적어보세요"
          placeholderTextColor="#BDBDBD"
          value={bio}
          onChangeText={setBio}
          maxLength={40}
        />
        <Text style={styles.charCount}>{bio.length}/40</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (step > 0) setStep(step - 1);
                else router.replace('/(auth)/welcome');
              }}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>회원가입</Text>
            <View style={{ width: 42 }} />
          </View>

          {renderStepIndicator()}

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 0 && renderTerms()}
            {step === 1 && renderNickname()}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={[styles.nextButton, (!canProceed() || signupLoading) && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={!canProceed() || signupLoading}
              activeOpacity={0.85}
            >
              {signupLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {step < STEPS.length - 1 ? '다음' : '시작하기'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#0B9A61',
  },
  stepDotDone: {
    backgroundColor: '#A8E6CF',
  },
  stepDotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#BDBDBD',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#BDBDBD',
    marginLeft: 6,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#0B9A61',
    fontWeight: '600',
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#A8E6CF',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9E9E9E',
    marginBottom: 24,
  },
  termsBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 4,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  termRowAll: {
    paddingVertical: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxActive: {
    backgroundColor: '#0B9A61',
    borderColor: '#0B9A61',
  },
  checkmark: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  termText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  termDetailLink: {
    fontSize: 13,
    color: '#9A9A9A',
    marginLeft: 8,
    fontWeight: '600',
  },
  termTextAll: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  termDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  inputSingle: {
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 15,
    color: '#1A1A1A',
  },
  charCount: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'right',
    marginTop: 6,
  },
  nicknameHint: {
    fontSize: 12,
    color: '#0B9A61',
    marginTop: 4,
  },
  nicknameError: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 4,
  },
  nicknameAvailable: {
    fontSize: 12,
    color: '#0B9A61',
    marginTop: 4,
  },
  nicknameChecking: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 4,
  },
  inputError: {
    borderColor: '#E53935',
  },
  optionalBadge: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9E9E9E',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderBtnActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#0B9A61',
  },
  genderBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  genderBtnTextActive: {
    color: '#0B9A61',
  },
  genderNotice: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 8,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  avatarPlaceholderText: {
    fontSize: 32,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: '50%',
    marginRight: -48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  avatarEditText: {
    fontSize: 12,
    color: '#666',
  },
  bottomSection: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
    paddingTop: 8,
  },
  nextButton: {
    backgroundColor: '#0B9A61',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
