'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { API_BASE } from '@/lib/api';

declare global {
  interface Window {
    Kakao: any;
  }
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '';

export default function LoginButtons() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kakao SDK 로드 (한 번만)
  useEffect(() => {
    if (!KAKAO_JS_KEY || typeof window === 'undefined') return;
    if (window.Kakao?.isInitialized?.()) return;
    if (document.getElementById('kakao-sdk')) return;
    const script = document.createElement('script');
    script.id = 'kakao-sdk';
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
    script.async = true;
    script.onload = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_JS_KEY);
      }
    };
    document.head.appendChild(script);
  }, []);

  const routeAfterLogin = async (uid: string) => {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(uid)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.ok) {
      const profile = await res.json();
      if (profile && !profile.withdrawnAt) {
        router.replace('/');
        return;
      }
    }
    router.replace('/signup');
  };

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      await routeAfterLogin(result.user.uid);
    } catch (e: any) {
      console.warn('Google login failed:', e);
      if (e?.code !== 'auth/popup-closed-by-user') {
        setError('Google 로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      await routeAfterLogin(result.user.uid);
    } catch (e: any) {
      console.warn('Apple login failed:', e);
      if (e?.code !== 'auth/popup-closed-by-user') {
        setError('Apple 로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKakao = () => {
    if (loading) return;
    if (typeof window === 'undefined' || !window.Kakao?.Auth) {
      setError('Kakao SDK 로딩 중이에요. 잠시 후 다시 시도해주세요.');
      return;
    }
    // v2 SDK 는 popup 미지원. authorization code grant (redirect) 만 가능.
    // 콜백 페이지에서 code → token 교환 후 Firebase Custom Token 으로 로그인.
    window.Kakao.Auth.authorize({
      redirectUri: `${window.location.origin}/login/kakao-callback`,
      scope: 'profile_nickname,account_email',
    });
  };

  return (
    <div className="auth-icons">
      <button
        type="button"
        className="auth-icon-btn auth-icon-kakao"
        onClick={handleKakao}
        disabled={loading}
        aria-label="카카오로 로그인"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#191919">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.91 5.36 4.78 6.78l-.97 3.55c-.09.32.26.58.55.4l4.26-2.81c.46.05.92.08 1.38.08 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
        </svg>
      </button>

      <button
        type="button"
        className="auth-icon-btn auth-icon-apple"
        onClick={handleApple}
        disabled={loading}
        aria-label="Apple로 로그인"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#000000">
          <path d="M17.05 12.04c-.02-2.59 2.12-3.83 2.21-3.89-1.21-1.76-3.08-2-3.75-2.03-1.59-.16-3.11.93-3.92.93-.81 0-2.07-.91-3.4-.89-1.75.03-3.36 1.01-4.26 2.57-1.82 3.15-.46 7.81 1.31 10.36.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84s2.02.84 3.4.81c1.4-.02 2.29-1.27 3.15-2.52 1-1.45 1.41-2.85 1.43-2.92-.03-.01-2.74-1.05-2.77-4.18zM14.55 4.39c.72-.87 1.2-2.09 1.07-3.3-1.04.04-2.29.69-3.03 1.56-.66.77-1.24 2-1.08 3.19 1.16.09 2.34-.59 3.04-1.45z" />
        </svg>
      </button>

      <button
        type="button"
        className="auth-icon-btn auth-icon-google"
        onClick={handleGoogle}
        disabled={loading}
        aria-label="Google로 로그인"
      >
        <svg width="28" height="28" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      </button>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
