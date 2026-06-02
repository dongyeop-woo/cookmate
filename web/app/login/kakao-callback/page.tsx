import { Suspense } from 'react';
import KakaoCallbackClient from './KakaoCallbackClient';

export const runtime = 'edge';

export const metadata = {
  title: '카카오 로그인 처리 중',
  robots: { index: false },
};

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<div className="kakao-cb">처리 중…</div>}>
      <KakaoCallbackClient />
    </Suspense>
  );
}
