'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { API_BASE } from '@/lib/api';

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? '';

export default function KakaoCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get('code');
    const kakaoError = params.get('error');
    if (kakaoError) {
      setError('카카오 로그인이 취소됐어요.');
      setTimeout(() => router.replace('/login'), 1500);
      return;
    }
    if (!code) {
      setError('잘못된 접근이에요.');
      setTimeout(() => router.replace('/login'), 1500);
      return;
    }

    (async () => {
      try {
        // 1) code → access_token (카카오 토큰 엔드포인트, Client Secret OFF 가정)
        const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: KAKAO_JS_KEY,
            redirect_uri: `${window.location.origin}/login/kakao-callback`,
            code,
          }).toString(),
        });
        if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}`);
        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        if (!accessToken) throw new Error('no access_token from kakao');

        // 2) 백엔드 → Firebase Custom Token
        const exchangeRes = await fetch(`${API_BASE}/api/auth/kakao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        });
        if (!exchangeRes.ok) throw new Error(`/api/auth/kakao ${exchangeRes.status}`);
        const exchangeData = await exchangeRes.json();
        const firebaseToken = exchangeData.firebaseToken;
        if (!firebaseToken) throw new Error('no firebaseToken in response');

        // 3) Firebase sign-in
        const cred = await signInWithCustomToken(getFirebaseAuth(), firebaseToken);

        // 4) 프로필 확인 → 신규면 /signup, 기존이면 /
        const idToken = await cred.user.getIdToken();
        const profRes = await fetch(
          `${API_BASE}/api/users/${encodeURIComponent(cred.user.uid)}`,
          { headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (profRes.ok) {
          const profile = await profRes.json();
          if (profile && !profile.withdrawnAt) {
            router.replace('/');
            return;
          }
        }
        router.replace('/signup');
      } catch (e: any) {
        console.warn('Kakao callback failed:', e);
        setError('카카오 로그인 처리에 실패했어요. 잠시 후 다시 시도해주세요.');
        setTimeout(() => router.replace('/login'), 2000);
      }
    })();
  }, [params, router]);

  return (
    <div className="kakao-cb">
      {error ? <div className="kakao-cb-err">{error}</div> : <div>카카오 로그인 처리 중…</div>}
    </div>
  );
}
