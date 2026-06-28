'use client';

import { useEffect, useState } from 'react';
import { fetchAllBlogViews } from '@/lib/api';

// 한 페이지에 여러 카드가 있어 매번 호출 X — 모듈 레벨 캐시.
let cache: Record<string, number> | null = null;
let pending: Promise<Record<string, number>> | null = null;

async function loadOnce(): Promise<Record<string, number>> {
  if (cache) return cache;
  if (!pending) pending = fetchAllBlogViews().then((m) => { cache = m; return m; });
  return pending;
}

/** 블로그 목록 카드의 조회수 (모든 글 한 번에 fetch). */
export default function BlogListViews({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    loadOnce().then((m) => { if (alive) setCount(m[slug] ?? 0); });
    return () => { alive = false; };
  }, [slug]);

  return (
    <span className="blog-card-views">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {count === null ? '–' : count.toLocaleString()}
    </span>
  );
}
