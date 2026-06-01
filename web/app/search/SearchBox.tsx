'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** 검색 입력 폼 — 엔터/제출 시 ?q=... 로 이동, 페이지가 SSR 로 결과 렌더. */
export default function SearchBox({ initialQuery = '' }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="search-grad-wrap">
        <div className="search-inner search-inner-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            type="search"
            placeholder="레시피, 재료, 카테고리"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          {q && (
            <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="지우기">×</button>
          )}
        </div>
      </div>
    </form>
  );
}
