'use client';

import { useEffect, useState } from 'react';
import { fetchBlogViewCount } from '@/lib/api';

/**
 * 블로그 글 상세 페이지의 조회수 표시.
 * 정적 빌드 + 클라이언트 fetch — 매 페이지 로드마다 최신 카운트.
 */
export default function BlogViewCount({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchBlogViewCount(slug).then((c) => { if (alive) setCount(c); });
    return () => { alive = false; };
  }, [slug]);

  return (
    <span className="blog-post-views">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      {count === null ? '–' : count.toLocaleString()}
    </span>
  );
}
