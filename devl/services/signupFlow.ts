import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { updateProfile, type User } from 'firebase/auth';
import { createUser } from './api';

/**
 * 회원가입 완료를 지연시키기 위해 임시로 보관할 프로필 정보.
 * "재료 등록하기" 플로우에서 my-fridge 화면의 "완료" 버튼을 누를 때 계정을 실제로 생성함.
 */
export type PendingSignup = {
  nickname: string;
  bio: string;
  gender: 'male' | 'female' | '';
  profileImage: string | null;
  // 약관 동의 추적 (signup에서 전달받아 백엔드에 저장)
  agreedTerms?: boolean;
  agreedPrivacy?: boolean;
  agreedAlimtalk?: boolean;
  agreedMarketing?: boolean;
  birthYear?: number | null;
};

// 약관 버전 — 개정 시 이 값을 올리고 앱 진입 시 재동의 강제 로직 추가 가능
export const TERMS_VERSION = '1.0.0';
export const PRIVACY_VERSION = '1.0.0';

const KEY = (uid: string) => `pending_signup:${uid}`;
const SOCIAL_EMAIL_KEY = (uid: string) => `social_email:${uid}`;

export async function savePendingSignup(uid: string, data: PendingSignup): Promise<void> {
  await AsyncStorage.setItem(KEY(uid), JSON.stringify(data));
}

export async function loadPendingSignup(uid: string): Promise<PendingSignup | null> {
  const raw = await AsyncStorage.getItem(KEY(uid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSignup;
  } catch {
    return null;
  }
}

export async function clearPendingSignup(uid: string): Promise<void> {
  await AsyncStorage.removeItem(KEY(uid));
}

// 카카오 로그인은 Firebase Custom Token 기반이라 firebaseUser.email이 비어있다.
// welcome.tsx에서 카카오 응답의 email을 잠시 보관해 두고, finalizeSignup이 읽어 사용한다.
export async function saveSocialEmail(uid: string, email: string): Promise<void> {
  if (!email) return;
  try { await AsyncStorage.setItem(SOCIAL_EMAIL_KEY(uid), email); } catch {}
}

async function loadSocialEmail(uid: string): Promise<string | null> {
  try { return await AsyncStorage.getItem(SOCIAL_EMAIL_KEY(uid)); } catch { return null; }
}

async function clearSocialEmail(uid: string): Promise<void> {
  try { await AsyncStorage.removeItem(SOCIAL_EMAIL_KEY(uid)); } catch {}
}

/**
 * 실제 계정 생성 — Firebase 프로필 업데이트 + 백엔드 createUser.
 * signup.tsx와 my-fridge.tsx(온보딩 완료) 둘 다에서 사용하기 위해 공유 로직으로 분리.
 */
export async function finalizeSignup(
  firebaseUser: User,
  pending: PendingSignup
): Promise<any> {
  const providerOriginalName = firebaseUser.providerData?.[0]?.displayName || '';
  const providerOriginalPhoto = firebaseUser.providerData?.[0]?.photoURL || '';
  const socialFallback = providerOriginalName || firebaseUser.displayName || '';

  const trimmedNickname = pending.nickname.trim();
  if (!trimmedNickname && !socialFallback) {
    throw new Error('닉네임이 필요합니다');
  }
  const finalNickname = trimmedNickname || socialFallback;

  await updateProfile(firebaseUser, { displayName: finalNickname });

  // 기본 프로필을 선택한 경우 'default' 문자열만 저장.
  // 화면 렌더 시점에 gender 기반으로 man.png/girl.png 로컬 자산을 사용한다.
  // (Image.resolveAssetSource(...).uri 는 dev/prod에서 다른 디바이스가 못 불러오는 값을 뱉어 사용 금지.)
  let finalProfileImage: string;
  if (pending.profileImage && pending.profileImage !== 'default') {
    finalProfileImage = pending.profileImage;
  } else if (pending.profileImage === 'default') {
    finalProfileImage = 'default';
  } else {
    finalProfileImage = providerOriginalPhoto || firebaseUser.photoURL || 'default';
  }

  let deviceId: string | undefined;
  try {
    if (Platform.OS === 'android') {
      deviceId = Application.getAndroidId() || undefined;
    } else {
      deviceId = (await Application.getIosIdForVendorAsync()) || undefined;
    }
  } catch {}

  const now = new Date().toISOString();
  // 카카오 가입자는 Custom Token 로그인이라 firebaseUser.email이 빈 값.
  // welcome.tsx에서 저장해 둔 카카오 이메일을 폴백으로 사용.
  const socialEmail = (await loadSocialEmail(firebaseUser.uid)) || '';
  const profile = await createUser({
    uid: firebaseUser.uid,
    email: firebaseUser.email || socialEmail || '',
    nickname: finalNickname,
    phone: '',
    profileImage: finalProfileImage,
    bio: pending.bio.trim() || '',
    gender: pending.gender,
    deviceId,
    kakaoId: firebaseUser.uid.startsWith('kakao:')
      ? firebaseUser.uid.replace('kakao:', '')
      : undefined,
    // 약관 동의 메타데이터 — 분쟁 대비 버전+타임스탬프 영구 보관
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    termsAgreedAt: pending.agreedTerms ? now : undefined,
    privacyAgreedAt: pending.agreedPrivacy ? now : undefined,
    alimtalkAgreedAt: pending.agreedAlimtalk ? now : undefined,
    marketingAgreedAt: pending.agreedMarketing ? now : null,
    birthYear: pending.birthYear ?? null,
  });

  // 환영 토스트 플래그 — 재가입 유저는 백엔드에서 보너스 스킵하므로 points=0.
  // 0P면 토스트 자체를 띄우지 않도록 저장 스킵.
  try {
    const earned = profile?.points ?? 0;
    if (earned > 0) {
      await AsyncStorage.setItem(`welcome:pending:${firebaseUser.uid}`, String(earned));
    }
  } catch {}

  await clearSocialEmail(firebaseUser.uid);

  return profile;
}
