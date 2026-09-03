'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthProvider';
import { API_BASE } from '@/lib/api';
import { setPostLoginRedirect } from '@/lib/post-login';

/**
 * 레시피 좋아요 버튼 — 앱 recipe/[id] 의 toggleLike 와 동일 동작.
 * 비로그인: 로그인 유도 모달. 로그인: optimistic 토글 후 실패하면 롤백.
 * 백엔드가 트랜잭션으로 멱등 처리하므로 중복 요청은 pending 으로만 막음.
 */
export default function LikeButton({
  recipeId,
  initialLikes,
}: { recipeId: string; initialLikes: number }) {
  const { firebaseUser, userProfile, refreshProfile } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialLikes);
  const [pending, setPending] = useState(false);
  const [askLogin, setAskLogin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 프로필이 로드되면 이미 좋아요한 레시피인지 반영.
  // 토글 후 refreshProfile 로 다시 흘러들어와 서버 상태로 자기 보정된다.
  useEffect(() => {
    setLiked(!!userProfile?.likedRecipes?.includes(recipeId));
  }, [userProfile?.likedRecipes, recipeId]);

  // 모달 열려 있는 동안 ESC 닫기 + 배경 스크롤 잠금 (AppDownloadModal 과 동일)
  useEffect(() => {
    if (!askLogin) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAskLogin(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [askLogin]);

  const toggle = async () => {
    if (!firebaseUser || !userProfile) {
      setAskLogin(true);
      return;
    }
    if (pending) return;
    setPending(true);

    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(
        `${API_BASE}/api/users/${encodeURIComponent(firebaseUser.uid)}/like/${encodeURIComponent(recipeId)}`,
        {
          method: wasLiked ? 'DELETE' : 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error(`like ${res.status}`);
      await refreshProfile();
    } catch {
      setLiked(wasLiked);
      setCount((c) => (wasLiked ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setPending(false);
    }
  };

  // 로그인 후 보던 레시피로 되돌아오게 경로를 남겨둔다.
  const goLogin = () => {
    setPostLoginRedirect(window.location.pathname);
    window.location.href = '/login';
  };

  const modal = askLogin ? (
    <div className="app-modal-overlay" onClick={() => setAskLogin(false)}>
      <div
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="like-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="app-modal-close"
          aria-label="닫기"
          onClick={() => setAskLogin(false)}
        >×</button>

        <div className="like-modal-icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>

        <h2 className="app-modal-title" id="like-modal-title">로그인이 필요해요</h2>
        <p className="app-modal-sub">
          로그인하면 마음에 드는 레시피에<br />좋아요를 남길 수 있어요.
        </p>

        <button type="button" className="like-modal-btn" onClick={goLogin}>
          로그인 / 회원가입
        </button>
        <button
          type="button"
          className="like-modal-later"
          onClick={() => setAskLogin(false)}
        >나중에 할게요</button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={liked ? 'like-btn liked' : 'like-btn'}
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? '좋아요 취소' : '좋아요'}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {count}
      </button>

      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
