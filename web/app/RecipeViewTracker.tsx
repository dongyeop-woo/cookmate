'use client';

import { useEffect } from 'react';
import { API_BASE } from '@/lib/api';

/**
 * 레시피 상세 페이지 조회 1회 기록.
 * 같은 세션 내 같은 레시피 중복 카운트 방지.
 */
export default function RecipeViewTracker({ id }: { id: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !id) return;
    try {
      const key = `yj_viewed:${id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      fetch(`${API_BASE}/api/web/recipe-view/${encodeURIComponent(id)}`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [id]);
  return null;
}
