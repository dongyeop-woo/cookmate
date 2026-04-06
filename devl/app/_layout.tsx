import { useState, useEffect, createContext, useContext } from 'react';
import { Stack } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { authInstance } from '../firebase';
import { registerForPushNotifications, getPushEnabled } from '../services/notifications';
import { updatePushToken } from '../services/api';

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
  bookmarkedRecipes: string[];
  recipeCount: number;
  totalLikes: number;
};

type AuthContextType = {
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  setUserProfile: (u: UserProfile | null) => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  setIsLoggedIn: () => {},
  firebaseUser: null,
  userProfile: null,
  setUserProfile: () => {},
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function Layout() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const { fetchUser } = require('../services/api');
          const profile = await fetchUser(user.uid);
          if (profile) {
            setUserProfile(profile);
            setIsLoggedIn(true);
            // 푸시 토큰 등록
            getPushEnabled().then(async (enabled) => {
              if (enabled) {
                const token = await registerForPushNotifications();
                if (token) {
                  updatePushToken(user.uid, token).catch(() => {});
                }
              }
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

  return (
    <AuthContext.Provider value={{ isLoggedIn, setIsLoggedIn, firebaseUser, userProfile, setUserProfile, loading }}>
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
        <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
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
    </AuthContext.Provider>
  );
}