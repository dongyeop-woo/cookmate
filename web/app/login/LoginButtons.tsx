'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { API_BASE } from '@/lib/api';

/**
 * Google 로그인 (Popup). Firebase 인증 후 백엔드에서 기존 프로필 조회 →
 *  - 있으면: 홈으로
 *  - 없으면: 회원가입(/signup)으로 이동해 닉네임/약관 입력 받기
 *
 * 카카오·애플 로그인은 추가 셋업 필요 — 우선 Google 만 지원.
 */
export default function LoginButtons() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(getFirebaseAuth(), provider);
      const user = result.user;
      const token = await user.getIdToken();
      // 백엔드에 프로필 있는지 확인
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(user.uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        if (profile && !profile.withdrawnAt) {
          router.replace('/');
          return;
        }
      }
      router.replace('/signup');
    } catch (e: any) {
      console.warn('Google login failed:', e);
      if (e?.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else {
        setError('로그인에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-buttons">
      <button type="button" className="auth-btn auth-btn-google" onClick={handleGoogle} disabled={loading}>
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        <span>Google로 계속하기</span>
      </button>

      <button type="button" className="auth-btn auth-btn-kakao" disabled aria-disabled="true" title="앱에서만 지원">
        <span className="auth-btn-kakao-icon">💬</span>
        <span>카카오 (앱에서 지원)</span>
      </button>

      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
