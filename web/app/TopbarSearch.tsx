'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 헤더에 박힌 검색 입력. 엔터/제출 시 /search?q=... 로 이동.
 * 검색 페이지에서는 현재 ?q= 값을 입력창에 자동 반영.
 */
export default function TopbarSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [q, setQ] = useState(urlQ);

  // URL ?q= 가 바뀌면 입력창도 동기화 (검색 결과 페이지에서 직접 URL 바꿀 때 대응)
  useEffect(() => {
    if (pathname === '/search') setQ(urlQ);
  }, [pathname, urlQ]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form className="topbar-search" onSubmit={submit} role="search">
      <span className="search-grad-wrap">
        <span className="search-inner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="topbar-search-input"
            type="search"
            placeholder="레시피 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="레시피 검색"
          />
          {q && (
            <button
              type="button"
              className="topbar-search-clear"
              onClick={() => setQ('')}
              aria-label="지우기"
            >×</button>
          )}
        </span>
      </span>
    </form>
  );
}
