import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { Text, TextInput, Platform, StyleSheet, LogBox, Animated, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import * as Updates from 'expo-updates';
import { mark } from '../services/perf';

mark('layout:module-load');

SplashScreen.preventAutoHideAsync().catch(() => {});

// 개발 중 불필요한 경고 숨김
LogBox.ignoreLogs([
  '[expo-image]: Prop "resizeMode" is deprecated',
  'Prop "resizeMode" is deprecated',
]);

// 시스템 폰트 크기 설정 무시
(Text as any).defaultProps = { ...(Text as any).defaultProps, allowFontScaling: false };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, allowFontScaling: false };

// iOS 기준으로 Android 폰트 정규화 (Android가 약 10% 크게 보이는 문제 보정)
const ANDROID_FONT_SCALE = 0.9;

// Android Text 렌더 시 StyleSheet.flatten이 매 프레임 수백 번 호출되며 메인 스레드를 잡아먹음.
// style 객체/배열 참조를 키로 결과를 WeakMap에 캐싱 — StyleSheet.create의 안정적 참조에 효과적.
// SCALE_NONE은 "스케일 불필요"를 캐시 히트로 표시하는 sentinel (객체 두 개로 null과 구분).
const SCALE_NONE: { fontSize?: number; lineHeight?: number } = Object.freeze({});
const scaledStyleCache: WeakMap<object, { fontSize?: number; lineHeight?: number }> = new WeakMap();

function getAndroidScaledStyle(style: any): { fontSize?: number; lineHeight?: number } | null {
  if (!style) return null;
  const isObj = typeof style === 'object';
  if (isObj) {
    const hit = scaledStyleCache.get(style);
    if (hit) return hit === SCALE_NONE ? null : hit;
  }
  const flat = StyleSheet.flatten(style) as any;
  if (!flat?.fontSize && !flat?.lineHeight) {
    if (isObj) scaledStyleCache.set(style, SCALE_NONE);
    return null;
  }
  const result: { fontSize?: number; lineHeight?: number } = {};
  if (flat.fontSize) result.fontSize = Math.round(flat.fontSize * ANDROID_FONT_SCALE);
  if (flat.lineHeight) result.lineHeight = Math.round(flat.lineHeight * ANDROID_FONT_SCALE);
  if (isObj) scaledStyleCache.set(style, result);
  return result;
}

const originalTextRender = (Text as any).render;
if (originalTextRender) {
  (Text as any).render = function (props: any, ref: any) {
    const baseStyle: any = { fontFamily: 'Pretendard-Regular' };
    const scaledStyle = Platform.OS === 'android' ? getAndroidScaledStyle(props.style) : null;
    // 명시적으로 allowFontScaling=false 강제 — defaultProps만으로는 일부 Android 디바이스에서
    // 시스템 폰트 확대(설정 → 디스플레이 → 글꼴 크기) 가 적용되어 레이아웃이 깨지는 문제 방지.
    // props에서 명시적으로 true로 넘긴 경우만 예외 허용.
    const allowFontScaling = props.allowFontScaling === true ? true : false;
    return originalTextRender.call(
      this,
      { ...props, allowFontScaling, style: [baseStyle, props.style, scaledStyle] },
      ref,
    );
  };
}
import { onAuthStateChanged, User } from 'firebase/auth';
import { InteractionManager } from 'react-native';
import { authInstance } from '../firebase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications, getPushEnabled } from '../services/notifications';
import { updatePushToken, updateLastActive, setAuthFailureHandler, clearAllCache, clearTokenCache } from '../services/api';
import { initPurchases, syncPremiumOnLaunch, logoutPurchases } from '../services/premium';
import { signOut } from 'firebase/auth';

type UserProfile = {
  uid: string;
  email: string;
  nickname: string;
  phone: string;
  profileImage: string;
  bio: string;
  gender: 'male' | 'female' | '';
  role: 'user' | 'admin';
  followers: string[];
  following: string[];
  likedRecipes: string[];
  recipeCount: number;
  totalLikes: number;
  points: number;
  withdrawnAt?: string | null;
  rejoinedAt?: string | null;
  status?: string | null;
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
  premiumSource?: 'admin' | 'revenuecat' | null;
};

type AuthContextType = {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (u: UserProfile | null) => void;
  loading: boolean;
  isPremium: boolean;
  refreshPremium: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  setIsLoggedIn: () => {},
  firebaseUser: null,
  userProfile: null,
  setUserProfile: () => {},
  loading: true,
  isPremium: false,
  refreshPremium: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function SplashImage() {
  return (
    <Image
      source={require('../assets/icons/splash.png')}
      style={{ width: '102%', height: '102%', marginLeft: '-1%', marginTop: '-1%' }}
      contentFit="cover"
    />
  );
}

export default function Layout() {
  mark('layout:render-start');
  const [fontsLoaded] = useFonts({
    'KimKongHae': require('../assets/KimKongHae.ttf'),
    'Pretendard-Regular': require('../assets/Pretendard-Regular.otf'),
    'Pretendard-Medium': require('../assets/Pretendard-Medium.otf'),
    'Pretendard-SemiBold': require('../assets/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/Pretendard-Bold.otf'),
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const router = useRouter();

  // 구매/복원 직후 프리미엄 상태 즉시 반영 — RC 재조회 + 백엔드 프로필 재로드.
  // 호출 시점: premium.tsx의 handleSubscribe / handleRestore 성공 후.
  const refreshPremium = useCallback(async () => {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    try {
      const result = await syncPremiumOnLaunch(uid, isPremium, userProfile?.premiumSource);
      setIsPremium(result);
      const { fetchUser } = require('../services/api');
      const fresh = await fetchUser(uid);
      if (fresh) setUserProfile(fresh);
    } catch {}
  }, [firebaseUser?.uid, isPremium, userProfile?.premiumSource]);

  // 스플래시 즉시 닫기 (오버레이로 대체) + 하단바 투명
  useEffect(() => {
    mark('layout:first-effect');
    SplashScreen.hideAsync().catch(() => {});
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('transparent').catch(() => {});
      NavigationBar.setPositionAsync('absolute').catch(() => {});
      NavigationBar.setButtonStyleAsync('dark').catch(() => {});
    }
  }, []);

  // OTA 업데이트가 있으면 즉시 다운로드 후 reload — 사용자가 앱을 두 번 껐다켤 필요 없음.
  // 개발 빌드에서는 동작 안 함(Updates.isEnabled === false).
  useEffect(() => {
    if (!Updates.isEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        // 다운로드 완료 → 즉시 reload하여 새 번들 적용
        await Updates.reloadAsync();
      } catch (_) {
        // 네트워크/서버 오류는 조용히 무시 — 다음 실행 때 다시 시도
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 커스텀 풀스크린 스플래시 오버레이.
  // auth 로드 끝나면 즉시 페이드아웃(최소 표시 800ms 보장 — 깜빡임 방지),
  // auth가 무한 지연되는 경우 3000ms fallback으로 강제 닫기.
  const [splashVisible, setSplashVisible] = useState(true);
  const splashFade = useRef(new Animated.Value(1)).current;
  const splashStartRef = useRef(Date.now());
  useEffect(() => {
    const MIN_SPLASH_MS = 800;
    const MAX_SPLASH_MS = 3000;
    const close = () => {
      mark('layout:splash-fade-start');
      Animated.timing(splashFade, { toValue: 0, duration: 400, useNativeDriver: true })
        .start(() => setSplashVisible(false));
    };
    const elapsed = Date.now() - splashStartRef.current;
    if (!loading) {
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      const t = setTimeout(close, remaining);
      return () => clearTimeout(t);
    }
    const fallback = setTimeout(close, Math.max(0, MAX_SPLASH_MS - elapsed));
    return () => clearTimeout(fallback);
  }, [loading, splashFade]);

  // 앱 시작 시 레거시 장바구니 키(@gifticon_cart) 정리 — 예전엔 기기 전체 공용이었음
  useEffect(() => {
    const cleanup = require('../services/cart').cleanupLegacyCart;
    cleanup?.().catch(() => {});
  }, []);

  // 에러 리포팅 초기화 (Sentry 연동 전까지는 no-op, 활성화 시 자동 작동)
  useEffect(() => {
    try {
      const { initErrorReporting } = require('../services/errorReporting');
      initErrorReporting();
    } catch {}
  }, []);

  // 인증 실패 자동 로그아웃 핸들러 등록 — token 갱신 후에도 401/403 받으면 호출됨.
  // 토큰 영구 만료, Firebase Auth 차단, 백엔드 권한 박탈 등을 graceful하게 처리.
  useEffect(() => {
    setAuthFailureHandler(async () => {
      try { await signOut(authInstance); } catch {}
      try { await logoutPurchases(); } catch {}
      clearAllCache();
      clearTokenCache();
      router.replace('/(auth)/welcome');
    });
    return () => setAuthFailureHandler(null);
  }, [router]);

  // 광고·추적 초기화 — UMP 동의폼(GDPR/EEA) → iOS ATT → AdMob init 순.
  // 스플래시 노출 후 약간 지연시켜 UX 방해 최소화.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const { initializeAdsAndTracking } = require('../services/tracking');
        initializeAdsAndTracking?.();
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  // 앱 시작 시 버전 체크 — 구버전은 강제 업데이트 모달, 보안 패치 대응
  const [forceUpdate, setForceUpdate] = useState<{ storeUrl: string; required: string } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { checkAppVersion } = require('../services/appVersion');
        const result = await checkAppVersion();
        if (result.status === 'force-update') {
          setForceUpdate({ storeUrl: result.storeUrl, required: result.required });
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const { fetchUser } = require('../services/api');
          const profile = await fetchUser(user.uid);
          // 탈퇴한 유저는 미가입 상태로 처리 (welcome → signup 플로우 태움)
          if (profile && !profile.withdrawnAt) {
            setUserProfile(profile);
            setIsLoggedIn(true);
            // 프리미엄 확인 — Firestore의 isPremium + premiumExpiresAt(있으면) 둘 다 만족해야 true.
            // 백엔드 만료 처리 누락 케이스에 클라이언트가 self-defense.
            // admin source는 만료 없음(영구)이므로 premiumSource='admin'이면 expiry 체크 스킵.
            const expiryOk = !profile.premiumExpiresAt
              || profile.premiumSource === 'admin'
              || new Date(profile.premiumExpiresAt).getTime() > Date.now();
            const initialPremium = !!profile.isPremium && expiryOk;
            setIsPremium(initialPremium);
            // 비핵심 백그라운드 작업 — 첫 페인트 후로 미뤄 콜드 스타트 메인 스레드 부담 감소.
            // 프리미엄 sync / 푸시 토큰 갱신 / lastActive 모두 사용자 즉시 동작에 영향 없음.
            InteractionManager.runAfterInteractions(() => {
              syncPremiumOnLaunch(user.uid, initialPremium, profile.premiumSource)
                .then(setIsPremium)
                .catch(() => {});
              // prompt:false — 앱 시작 시에는 절대 시스템 권한창을 띄우지 않는다.
              // 앱이 뭘 하는지도 모르는 시점의 요청은 거부율이 가장 높고, iOS 는
              // 한 번 거부당하면 앱에서 다시 물을 수 없다. 실제로 가입자의 68%가
              // 토큰 없는 상태였다(2026-09-26). 요청은 홈의 사전 동의 시트에서만 한다.
              getPushEnabled().then(async (enabled) => {
                if (enabled) {
                  try {
                    const token = await registerForPushNotifications({ prompt: false });
                    if (token) await updatePushToken(user.uid, token);
                  } catch {}
                }
              });
              updateLastActive(user.uid).catch(() => {});
            });
          } else {
            // Firebase Auth 계정은 있지만 Firestore 프로필이 없음 (신규 소셜 로그인 사용자)
            setIsLoggedIn(false);
          }
        } catch (e) {
          console.warn('프로필 로드 실패:', e);
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 푸시 알림 수신 리스너
  useEffect(() => {
    // 앱이 포그라운드일 때 알림 수신
    const receivedSub = Notifications.addNotificationReceivedListener(() => {});

    // 알림 탭 시 알림 페이지로 이동
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notifications');
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn, firebaseUser, userProfile, setUserProfile, loading, isPremium, refreshPremium }}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 200,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="category" options={{ headerShown: false }} />
        <Stack.Screen name="invite" options={{ headerShown: false }} />
        <Stack.Screen name="kakaolink" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/edit"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="cooking/[id]"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="community/write"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="community/[id]"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="my-activity"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="my-gifticons"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="my-fridge"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="fridge-add"
          options={{ headerShown: false, animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="fridge-add-details"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="fridge-settings"
          options={{ headerShown: false, animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="announcements"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="contact"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="profile/[uid]"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="menu"
          options={{ headerShown: false, animation: 'fade' }}
        />
      </Stack>
      {splashVisible && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: splashFade, backgroundColor: '#FFFFFF', zIndex: 9999 }]}>
          <SplashImage />
        </Animated.View>
      )}
      {forceUpdate && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 10000 }]}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 }}>업데이트가 필요해요</Text>
            <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 20 }}>
              보안 및 안정성 개선을 위해 최신 버전({forceUpdate.required})으로 업데이트해주세요.
            </Text>
            <TouchableOpacity
              onPress={() => {
                const { openStore } = require('../services/appVersion');
                openStore(forceUpdate.storeUrl);
              }}
              style={{ backgroundColor: '#1BAE74', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>스토어로 이동</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </AuthContext.Provider>
  );
}