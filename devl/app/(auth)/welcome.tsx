import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as KakaoLogin from '@react-native-seoul/kakao-login';
import { GoogleAuthProvider, signInWithCredential, signInWithCustomToken } from 'firebase/auth';
import { authInstance } from '../../firebase';
import { FontAwesome } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential as firebaseSignInWithCredential } from 'firebase/auth';
import { fetchUser, exchangeKakaoToken } from '../../services/api';
import { saveSocialEmail } from '../../services/signupFlow';

GoogleSignin.configure({
  webClientId: '879574205436-39lmp1t64f1mb7je6bh7va6lvqa01r14.apps.googleusercontent.com',
  iosClientId: '879574205436-shfbj46e97a9n89fa133ggqtkgob25ec.apps.googleusercontent.com',
});

export default function WelcomeScreen() {
  const router = useRouter();
  const { setIsLoggedIn, setUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleAuthResult = async (uid: string) => {
    const profile = await fetchUser(uid);
    // 탈퇴한 유저(soft-delete)는 신규 유저처럼 회원가입 플로우로 보냄
    if (profile && !profile.withdrawnAt) {
      setUserProfile(profile);
      setIsLoggedIn(true);
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/signup');
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (isSuccessResponse(response)) {
        const idToken = response.data?.idToken;
        if (!idToken) throw new Error('No ID token');
        const credential = GoogleAuthProvider.credential(idToken);
        const cred = await signInWithCredential(authInstance, credential);
        await handleAuthResult(cred.user.uid);
      }
    } catch (error: any) {
      if (error.code !== '12501' && error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('로그인 실패', 'Google 로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const token = await KakaoLogin.login();
      const result = await exchangeKakaoToken(token.accessToken);
      if (!result.success) {
        Alert.alert('로그인 실패', result.message || '카카오 로그인에 실패했습니다.');
        return;
      }
      const cred = await signInWithCustomToken(authInstance, result.firebaseToken);
      // 카카오는 Custom Token 로그인이라 firebaseUser.email이 비어있다.
      // 신규 가입 시 finalizeSignup에서 사용할 수 있도록 카카오 이메일을 잠시 보관.
      if (result.email) {
        await saveSocialEmail(cred.user.uid, result.email);
      }
      await handleAuthResult(cred.user.uid);
    } catch (error: any) {
      if (error.message !== 'user cancelled login') {
        Alert.alert('로그인 실패', '카카오 로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { identityToken } = response;
      if (!identityToken) throw new Error('No identity token');
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken });
      const cred = await firebaseSignInWithCredential(authInstance, credential);
      await handleAuthResult(cred.user.uid);
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('로그인 실패', 'Apple 로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 로고 영역 — 화면 상단 40% 지점에 중앙 배치 */}
      <View style={styles.center}>
        <Animated.View style={[styles.appIconWrapper, { transform: [{ translateY: floatAnim }] }]}>
          <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
        </Animated.View>
        <Text style={styles.appName}>오늘 뭐 해먹지?</Text>
        <Text style={styles.tagline}>쉽고 맛있게 따라하는 오늘의 레시피</Text>
      </View>

      {/* 하단 고정 소셜 로그인 */}
      <View style={styles.bottom}>
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin} activeOpacity={0.75} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#999" /> : <Image source={require('../../assets/icons/google.png')} style={styles.socialIcon} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.kakaoBtn} onPress={handleKakaoLogin} activeOpacity={0.75} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color="#191919" /> : <Image source={require('../../assets/icons/kakao.png')} style={styles.socialIcon} />}
          </TouchableOpacity>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={styles.appleBtn} onPress={handleAppleLogin} activeOpacity={0.75} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#1A1A1A" /> : <FontAwesome name="apple" size={26} color="#1A1A1A" />}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.termsRow}>
          <Text style={styles.termsText}>계속 진행 시 </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/terms-service')}>
            <Text style={styles.termsLink}>이용약관</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}> 및 </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/terms-privacy')}>
            <Text style={styles.termsLink}>개인정보 처리방침</Text>
          </TouchableOpacity>
          <Text style={styles.termsText}>에 동의합니다</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // 로고: 화면 상단부 중앙 (flex로 공간 차지, 살짝 위쪽에 중심)
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingTop: '20%',
  },
  appIconWrapper: {
    marginBottom: 4,
  },
  appIcon: {
    width: 110,
    height: 110,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: '#999',
    fontWeight: '500',
  },

  // 하단 고정
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 76 : 98,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  googleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F2F2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kakaoBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  socialIcon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },

  // 약관
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#BDBDBD',
  },
  termsLink: {
    fontSize: 12,
    color: '#BDBDBD',
    textDecorationLine: 'underline',
  },
});
