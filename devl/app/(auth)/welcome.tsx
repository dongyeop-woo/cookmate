import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as KakaoLogin from '@react-native-seoul/kakao-login';
import { GoogleAuthProvider, signInWithCredential, signInWithCustomToken } from 'firebase/auth';
import { authInstance } from '../../firebase';
import { fetchUser, exchangeKakaoToken } from '../../services/api';

GoogleSignin.configure({
  webClientId: '879574205436-39lmp1t64f1mb7je6bh7va6lvqa01r14.apps.googleusercontent.com',
  iosClientId: '879574205436-shfbj46e97a9n89fa133ggqtkgob25ec.apps.googleusercontent.com',
});

export default function WelcomeScreen() {
  const router = useRouter();
  const { setIsLoggedIn, setUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isSmall = width < 500;
  const heroFontSize = isSmall ? Math.min(width * 0.115, 48) : 58;
  const heroGap = isSmall ? 50 : 90;
  const pad1 = isSmall ? width * 0.06 : 50;
  const pad2 = isSmall ? width * 0.28 : 240;
  const pad3 = isSmall ? width * 0.1 : 90;
  const badgeSize = isSmall ? 50 : 66;
  const emojiSize = isSmall ? 42 : 56;
  const topPad = isSmall ? '45%' : '28%';

  const line1Anim = useRef(new Animated.Value(0)).current;
  const line2Anim = useRef(new Animated.Value(0)).current;
  const line3Anim = useRef(new Animated.Value(0)).current;
  const line1Scale = useRef(new Animated.Value(0.3)).current;
  const line2Scale = useRef(new Animated.Value(0.3)).current;
  const line3Scale = useRef(new Animated.Value(0.3)).current;
  const line1Float = useRef(new Animated.Value(0)).current;
  const line2Float = useRef(new Animated.Value(0)).current;
  const line3Float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounceIn = (opacity: Animated.Value, scale: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.08,
            duration: 300,
            delay,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 4,
            tension: 200,
            useNativeDriver: true,
          }),
        ]),
      ]);

    const float = (anim: Animated.Value, delay: number) => {
      const loop = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: -5,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 5,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]).start(() => loop());
      };
      setTimeout(loop, delay + 600);
    };

    Animated.stagger(0, [
      bounceIn(line1Anim, line1Scale, 200),
      bounceIn(line2Anim, line2Scale, 500),
      bounceIn(line3Anim, line3Scale, 800),
    ]).start();

    float(line1Float, 200);
    float(line2Float, 600);
    float(line3Float, 1000);
  }, []);

  const handleAuthResult = async (uid: string) => {
    const profile = await fetchUser(uid);
    if (profile) {
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
        console.error('Google login error:', error);
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
      await handleAuthResult(cred.user.uid);
    } catch (error: any) {
      if (error.message !== 'user cancelled login') {
        console.error('Kakao login error:', error);
        Alert.alert('로그인 실패', '카카오 로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.content, { paddingTop: topPad }]}>
        <View style={[styles.heroSection, { gap: heroGap }]}>
          <Animated.View style={[styles.heroLine, { paddingLeft: pad1, opacity: line1Anim, transform: [{ scale: line1Scale }, { translateY: line1Float }] }]}>
            <Text style={[styles.heroText, { fontSize: heroFontSize }]}>쉽고 맛있게</Text>
            <View style={[styles.iconBadge, { width: badgeSize, height: badgeSize }]}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.iconImage}
              />
            </View>
          </Animated.View>

          <Animated.View style={[styles.heroLine, { paddingLeft: pad2, opacity: line2Anim, transform: [{ scale: line2Scale }, { translateY: line2Float }] }]}>
            <Text style={[styles.iconEmoji2, { fontSize: emojiSize }]}>🍳</Text>
            <Text style={[styles.heroText, { fontSize: heroFontSize }]} numberOfLines={1}>따라하는</Text>
          </Animated.View>

          <Animated.View style={[styles.heroLine, { paddingLeft: pad3, opacity: line3Anim, transform: [{ scale: line3Scale }, { translateY: line3Float }] }]}>
            <Text style={[styles.heroText, { fontSize: heroFontSize }]}>오늘의 레시피</Text>
          </Animated.View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        {loading && (
          <ActivityIndicator size="small" color="#0B9A61" style={{ marginBottom: 12 }} />
        )}

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Image source={require('../../assets/icons/google.png')} style={styles.btnIcon} />
          <Text style={styles.googleBtnText}>Google로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.kakaoBtn}
          onPress={handleKakaoLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Image source={require('../../assets/icons/kakao.png')} style={styles.btnIcon} />
          <Text style={styles.kakaoBtnText}>카카오로 계속하기</Text>
        </TouchableOpacity>

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
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 44,
    paddingTop: '35%',
  },
  heroSection: {
    gap: 90, // overridden by inline style
  },
  heroLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroText: {
    fontSize: 58, // overridden by inline style
    fontWeight: '900',
    color: '#1A1A1A',
    letterSpacing: -1.2,
  },
  iconBadge: {
    width: 66, // overridden by inline style
    height: 66, // overridden by inline style
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  iconImage: {
    width: 38,
    height: 38,
    resizeMode: 'contain',
  },
  iconEmoji2: {
    fontSize: 56, // overridden by inline style
    marginRight: 10,
    color: '#0B9A61',
  },
  bottomSection: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 20 : 32,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  btnIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
    resizeMode: 'contain',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  kakaoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE500',
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 20,
  },
  kakaoBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#191919',
  },
  termsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  termsLink: {
    fontSize: 12,
    color: '#0B9A61',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
