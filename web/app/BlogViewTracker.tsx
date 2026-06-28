'use client';

import { useEffect } from 'react';
import { API_BASE } from '@/lib/api';

/**
 * 블로그 글 페이지 조회 1회 기록.
 * 같은 세션 내 같은 글 중복 카운트 방지 (sessionStorage).
 * RecipeViewTracker 와 동일 패턴.
 */
export default function BlogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !slug) return;
    try {
      const key = `yj_blog_viewed:${slug}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      fetch(`${API_BASE}/api/web/blog-view/${encodeURIComponent(slug)}`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, [slug]);
  return null;
}
