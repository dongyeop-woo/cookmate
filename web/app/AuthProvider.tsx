'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { API_BASE, UserProfile } from '@/lib/api';

type AuthState = {
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  firebaseUser: null,
  userProfile: null,
  logout: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() { return useContext(AuthContext); }

/** 백엔드에서 유저 프로필 가져오기 (로그인된 firebase 토큰 첨부). */
async function loadProfile(user: FirebaseUser): Promise<UserProfile | null> {
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(user.uid)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!firebaseUser) return;
    const p = await loadProfile(firebaseUser);
    setUserProfile(p);
  };

  const logout = async () => {
    await signOut(getFirebaseAuth());
    setUserProfile(null);
  };

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const p = await loadProfile(user);
        setUserProfile(p);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <AuthContext.Provider value={{ loading, firebaseUser, userProfile, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
