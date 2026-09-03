'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { resolveProfileImage } from '@/lib/api';

/**
 * 모바일 웹 전용 — 방문자 통계 좌측에 로그인 진입점.
 * 데스크탑은 사이드바 SidebarLogin 이 있어서 숨김 (CSS @media).
 * 로그인 상태에서는 눌러서 로그아웃할 수 있어야 한다 — 모바일엔 사이드바가 없어
 * 여기 말고는 로그아웃할 방법이 없음.
 */
export default function MobileLoginButton() {
  const { firebaseUser, userProfile, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // 바깥 클릭 / ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading) return <span className="mobile-login mobile-login-skeleton" />;

  if (firebaseUser && userProfile) {
    const img = resolveProfileImage(userProfile.profileImage, userProfile.gender);
    const points = (userProfile.points ?? 0).toLocaleString();
    return (
      <span className="mobile-login mobile-login-wrap" ref={wrapRef}>
        <button
          type="button"
          className="mobile-login-user"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <img src={img} alt="" />
          <span>{userProfile.nickname ?? '회원'} · {points}P</span>
          <svg
            className={open ? 'mobile-login-caret open' : 'mobile-login-caret'}
            width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <span className="mobile-login-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={async () => { setOpen(false); await logout(); }}
            >로그아웃</button>
          </span>
        )}
      </span>
    );
  }

  return (
    <a className="mobile-login" href="/login">로그인</a>
  );
}
