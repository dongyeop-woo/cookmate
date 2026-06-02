'use client';

import { useAuth } from './AuthProvider';
import { resolveProfileImage } from '@/lib/api';

/**
 * 모바일 웹 전용 — 방문자 통계 좌측에 로그인 진입점.
 * 데스크탑은 사이드바 SidebarLogin 이 있어서 숨김 (CSS @media).
 */
export default function MobileLoginButton() {
  const { firebaseUser, userProfile, loading } = useAuth();

  if (loading) return <span className="mobile-login mobile-login-skeleton" />;

  if (firebaseUser && userProfile) {
    const img = resolveProfileImage(userProfile.profileImage, userProfile.gender);
    const points = (userProfile.points ?? 0).toLocaleString();
    return (
      <span className="mobile-login mobile-login-user">
        <img src={img} alt="" />
        <span>{userProfile.nickname ?? '회원'} · {points}P</span>
      </span>
    );
  }

  return (
    <a className="mobile-login" href="/login">로그인</a>
  );
}
