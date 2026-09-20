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
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { consumePendingTermAgreement } from '../../constants/termsAgreementState';
import { updateProfile } from 'firebase/auth';
import { authInstance } from '../../firebase';
import { useAuth } from '../_layout';
import { createUser, checkNicknameAvailable } from '../../services/api';
import { savePendingSignup, finalizeSignup } from '../../services/signupFlow';
import { Ionicons } from '@expo/vector-icons';

const STEPS = [
  { key: 'terms', title: '이용약관' },
  { key: 'nickname', title: '프로필 설정' },
  { key: 'fridge', title: '냉장고' },
] as const;

const TERMS = [
  { id: 'all', label: '전체 동의', required: false, isAll: true },
  { id: 'age14', label: '[필수] 만 14세 이상입니다', required: true },
  { id: 'service', label: '[필수] 서비스 이용약관 동의', required: true },
  { id: 'privacy', label: '[필수] 개인정보 처리방침 동의', required: true },
  { id: 'alimtalk', label: '[필수] 거래 알림톡 수신 동의 (기프티콘 발송 등)', required: true },
  { id: 'marketing', label: '[선택] 마케팅 알림톡·푸시 수신 동의', required: false },
];

function FridgeFeatureRow({ icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <View style={styles.fridgeFeatureRow}>
      <View style={styles.fridgeFeatureIcon}>
        <Ionicons name={icon} size={18} color="#1A1A1A" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.fridgeFeatureTitle}>{title}</Text>
        <Text style={styles.fridgeFeatureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const { firebaseUser, setIsLoggedIn, setUserProfile } = useAuth();
  const [step, setStep] = useState(0);

  // Step 0: Terms
  const [agreedTerms, setAgreedTerms] = useState<Record<string, boolean>>({});

  // Step 1: Nickname, Bio, Gender & Profile Photo
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
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

  const handleComplete = async (opts?: { goToFridge?: boolean }) => {
    if (!firebaseUser) {
      Alert.alert('오류', '로그인 정보가 없습니다. 다시 시도해주세요.');
      router.replace('/(auth)/welcome');
      return;
    }
    const providerOriginalName = firebaseUser.providerData?.[0]?.displayName || '';
    const socialFallback = providerOriginalName || firebaseUser.displayName || '';
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname && !socialFallback) {
      Alert.alert('닉네임 필요', '앱에서 사용할 닉네임을 입력해주세요.');
      setStep(1);
      return;
    }

    // "재료 등록하기" 경로 — 계정 생성은 냉장고 "완료" 버튼에서 수행
    if (opts?.goToFridge) {
      try {
        await savePendingSignup(firebaseUser.uid, {
          nickname: trimmedNickname,
          bio: bio.trim(),
          gender,
          profileImage,
          agreedTerms: !!agreedTerms.service,
          agreedPrivacy: !!agreedTerms.privacy,
          agreedAlimtalk: !!agreedTerms.alimtalk,
          agreedMarketing: !!agreedTerms.marketing,
        });
        router.replace({ pathname: '/my-fridge', params: { onboarding: '1' } });
      } catch (e: any) {
        Alert.alert('오류', e?.message || '임시 저장에 실패했습니다.');
      }
      return;
    }

    // "건너뛰기" — 즉시 계정 생성 + 홈으로
    setSignupLoading(true);
    try {
      const profile = await finalizeSignup(firebaseUser, {
        nickname: trimmedNickname,
        bio: bio.trim(),
        gender,
        profileImage,
        agreedTerms: !!agreedTerms.service,
        agreedPrivacy: !!agreedTerms.privacy,
        agreedAlimtalk: !!agreedTerms.alimtalk,
        agreedMarketing: !!agreedTerms.marketing,
      });
      setUserProfile(profile);
      setIsLoggedIn(true);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Signup error:', error);
      const msg = error?.message || '프로필 생성에 실패했습니다. 다시 시도해주세요.';
      Alert.alert('가입 실패', msg);
    } finally {
      setSignupLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return allTermsAgreed;
      case 1: {
        // 소셜 계정에서 이름을 제공하지 않은 경우(예: Apple '가리기')엔 닉네임 필수
        const providerName = firebaseUser?.providerData?.[0]?.displayName || '';
        const socialName = providerName || firebaseUser?.displayName || '';
        const needsNickname = !socialName;
        const nicknameFilled = needsNickname ? nickname.trim().length >= 2 : true;
        return nicknameStatus !== 'taken' && nicknameFilled;
      }
      case 2: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  // 반응형 step indicator — 각 step을 column(dot 위, label 아래)으로 배치.
  // 폰트가 커져도 label이 dot 아래에서 wrap만 되어 가로 overflow 방지.
  // 라인은 dot 좌우에서 column 폭만큼 채우는 구조.
  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {STEPS.map((s, i) => {
        const isActive = i <= step;
        const isDone = i < step;
        return (
          <View key={s.key} style={styles.stepCol}>
            <View style={styles.stepDotRow}>
              {/* 왼쪽 line: 첫 번째 step 제외 */}
              {i > 0 ? (
                <View style={[styles.stepLine, isActive && styles.stepLineActive]} />
              ) : (
                <View style={styles.stepLineSpacer} />
              )}
              <View style={[
                styles.stepDot,
                isActive && styles.stepDotActive,
                isDone && styles.stepDotDone,
              ]}>
                <Text style={[styles.stepDotText, isActive && styles.stepDotTextActive]}>
                  {isDone ? '✓' : i + 1}
                </Text>
              </View>
              {/* 오른쪽 line: 마지막 step 제외 */}
              {i < STEPS.length - 1 ? (
                <View style={[styles.stepLine, i < step && styles.stepLineActive]} />
              ) : (
                <View style={styles.stepLineSpacer} />
              )}
            </View>
            <Text
              style={[styles.stepLabel, isActive && styles.stepLabelActive]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {s.title}
            </Text>
          </View>
        );
      })}
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
                  {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
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

  // providerData는 소셜 프로바이더가 준 원본 정보. displayName은 앱에서 닉네임 설정 시
  // updateProfile()로 덮어써서 이전 닉네임이 남을 수 있으니 providerData를 우선.
  const providerName = firebaseUser?.providerData?.[0]?.displayName || '';
  const providerPhoto = firebaseUser?.providerData?.[0]?.photoURL || '';
  const socialName = providerName || firebaseUser?.displayName || '';
  const socialPhoto = providerPhoto || firebaseUser?.photoURL || '';

  const getAvatarSource = () => {
    if (profileImage && profileImage !== 'default') return { uri: profileImage };
    if (profileImage !== 'default' && socialPhoto) return { uri: socialPhoto };
    if (gender === 'female') return require('../../assets/girl.png');
    return require('../../assets/man.png');
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
          <Ionicons name="pencil" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          닉네임 {!socialName && <Text style={styles.requiredMark}>*</Text>}
        </Text>
        <TextInput
          style={[styles.inputSingle, nicknameStatus === 'taken' && styles.inputError]}
          placeholder={socialName ? `${socialName} (미입력 시 자동 설정)` : '2자 이상 입력해주세요'}
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
        ) : (
          <Text style={styles.nicknameHint}>앱에서 사용할 닉네임을 2자 이상 입력해주세요</Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>성별 <Text style={styles.optionalBadge}>(선택)</Text></Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
            onPress={() => setGender(gender === 'male' ? '' : 'male')}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderBtnText, gender === 'male' && styles.genderBtnTextActive]}>남자</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
            onPress={() => setGender(gender === 'female' ? '' : 'female')}
            activeOpacity={0.8}
          >
            <Text style={[styles.genderBtnText, gender === 'female' && styles.genderBtnTextActive]}>여자</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.genderNotice}>기본 프로필 이미지 표시에만 사용됩니다. 선택하지 않아도 가입할 수 있어요.</Text>
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

  const renderFridge = () => (
    <View>
      <Text style={styles.sectionTitle}>냉장고를 채워볼까요?</Text>
      <Text style={styles.sectionSubtitle}>
        보관 중인 재료와 유효기간을 관리하고, 재료 기반 레시피를 추천받아 보세요
      </Text>

      <View style={styles.fridgeHero}>
        <View style={styles.fridgeHeroIcon}>
          <Ionicons name="nutrition" size={34} color="#E53935" />
        </View>
        <Text style={styles.fridgeHeroTitle}>유효기간 관리가 쉬워져요</Text>
        <Text style={styles.fridgeHeroSub}>
          임박한 재료는 알림으로 알려드리고,{'\n'}
          남은 재료로 만들 수 있는 레시피를 추천합니다
        </Text>
      </View>

      <View style={styles.fridgeFeatureList}>
        <FridgeFeatureRow
          icon="search-outline"
          title="HACCP 식품 검색"
          desc="제품명만 입력하면 정식 식품 정보를 불러와요"
        />
        <FridgeFeatureRow
          icon="notifications-outline"
          title="유효기간 알림"
          desc="3일 전, 1일 전, 당일 알림이 자동으로 발송돼요"
        />
        <FridgeFeatureRow
          icon="sparkles-outline"
          title="재료 기반 레시피"
          desc="남은 재료로 만들 수 있는 요리를 추천받아요"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
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
              <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>회원가입</Text>
            <View style={{ width: 42 }} />
          </View>

          {renderStepIndicator()}

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {step === 0 && renderTerms()}
            {step === 1 && renderNickname()}
            {step === 2 && renderFridge()}
            <View style={{ height: 100 }} />
          </ScrollView>

          <View style={styles.bottomSection}>
            {step < 2 ? (
              <TouchableOpacity
                style={[styles.nextButton, (!canProceed() || signupLoading) && styles.nextButtonDisabled]}
                onPress={handleNext}
                disabled={!canProceed() || signupLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.nextButtonText}>다음</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.finalButtonRow}>
                <TouchableOpacity
                  style={[styles.skipButton, signupLoading && { opacity: 0.5 }]}
                  onPress={() => handleComplete({ goToFridge: false })}
                  disabled={signupLoading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.skipButtonText}>건너뛰기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextButton, { flex: 1 }, signupLoading && styles.nextButtonDisabled]}
                  onPress={() => handleComplete({ goToFridge: true })}
                  disabled={signupLoading}
                  activeOpacity={0.85}
                >
                  {signupLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.nextButtonText}>재료 등록하기</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
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
  // 반응형 step indicator — 각 step이 column으로 화면을 1/3 씩 차지.
  // dot+양옆 line 은 윗 row에서 가로로 늘어나고, label은 아래에서 wrap 가능.
  // 폰트 확대 시에도 가로 overflow 발생 안 함.
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  stepCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  stepDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepDotActive: {
    backgroundColor: '#1BAE74',
  },
  stepDotDone: {
    backgroundColor: '#E5E5EA',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BDBDBD',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#BDBDBD',
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  stepLabelActive: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#F0F0F0',
  },
  stepLineActive: {
    backgroundColor: '#1BAE74',
  },
  // 첫/마지막 column에서 dot 양옆 정렬 유지용 빈 공간
  stepLineSpacer: {
    flex: 1,
    height: 2,
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
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: '#1BAE74',
    borderColor: '#1BAE74',
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  charCount: {
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'right',
    marginTop: 6,
  },
  requiredMark: {
    color: '#FF3B30',
    fontWeight: '800',
  },
  nicknameHint: {
    fontSize: 12,
    color: '#1A1A1A',
    marginTop: 4,
  },
  nicknameError: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 4,
  },
  nicknameAvailable: {
    fontSize: 12,
    color: '#1A1A1A',
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
    backgroundColor: '#F5F5F7',
    borderColor: '#1A1A1A',
  },
  genderBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  genderBtnTextActive: {
    color: '#1A1A1A',
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
    bottom: 2,
    right: '50%',
    marginRight: -50,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#1BAE74',
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

  // 최종 단계 버튼 (건너뛰기 + 재료 등록)
  finalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 17,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5A5A5F',
  },

  // 냉장고 단계
  fridgeHero: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
  },
  fridgeHeroIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  fridgeHeroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  fridgeHeroSub: {
    fontSize: 13,
    color: '#5A5A5F',
    textAlign: 'center',
    lineHeight: 19,
  },

  fridgeFeatureList: {
    gap: 12,
  },
  fridgeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
  },
  fridgeFeatureIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeFeatureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 3,
  },
  fridgeFeatureDesc: {
    fontSize: 12,
    color: '#5A5A5F',
    lineHeight: 17,
  },
});
