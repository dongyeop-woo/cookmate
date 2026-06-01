'use client';

import { useAuth } from './AuthProvider';
import { resolveProfileImage } from '@/lib/api';

/**
 * 사이드바 로그인 박스 — 로그인 상태면 프로필/로그아웃, 아니면 로그인/회원가입 버튼.
 */
export default function SidebarLogin() {
  const { firebaseUser, userProfile, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="side-box side-login">
        <div className="side-login-row">
          <div className="side-login-avatar" />
          <div className="side-login-text">
            <div className="side-login-title">…</div>
          </div>
        </div>
      </div>
    );
  }

  if (firebaseUser && userProfile) {
    const img = resolveProfileImage(userProfile.profileImage, userProfile.gender);
    return (
      <div className="side-box side-login">
        <div className="side-login-row">
          <img className="side-login-avatar-img" src={img} alt="" />
          <div className="side-login-text">
            <div className="side-login-title">{userProfile.nickname ?? '회원'}</div>
            <div className="side-login-sub">
              레시피 {userProfile.recipeCount ?? 0} · ♥ {userProfile.totalLikes ?? 0}
            </div>
          </div>
        </div>
        <button type="button" className="side-login-btn" onClick={logout}>로그아웃</button>
      </div>
    );
  }

  return (
    <div className="side-box side-login">
      <div className="side-login-row">
        <div className="side-login-avatar">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div className="side-login-text">
          <div className="side-login-title">로그인이 필요해요</div>
          <div className="side-login-sub">로그인하고 모든 기능 사용</div>
        </div>
      </div>
      <a href="/login" className="side-login-btn">로그인 / 회원가입</a>
    </div>
  );
}
