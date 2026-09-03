'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { API_BASE } from '@/lib/api';

/**
 * 레시피 좋아요 버튼 — 앱 recipe/[id] 의 toggleLike 와 동일 동작.
 * 비로그인: 로그인 안내 노출. 로그인: optimistic 토글 후 실패하면 롤백.
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
  const [notice, setNotice] = useState(false);

  // 프로필이 로드되면 이미 좋아요한 레시피인지 반영.
  // 토글 후 refreshProfile 로 다시 흘러들어와 서버 상태로 자기 보정된다.
  useEffect(() => {
    setLiked(!!userProfile?.likedRecipes?.includes(recipeId));
  }, [userProfile?.likedRecipes, recipeId]);

  const toggle = async () => {
    if (!firebaseUser || !userProfile) {
      setNotice(true);
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
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {count}
      </button>

      {notice && (
        <span className="like-notice" role="status">
          로그인하면 좋아요를 누를 수 있어요.
          <a href="/login">로그인</a>
          <button
            type="button"
            className="like-notice-x"
            onClick={() => setNotice(false)}
            aria-label="안내 닫기"
          >×</button>
        </span>
      )}
    </>
  );
}
