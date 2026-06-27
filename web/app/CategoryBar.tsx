import { CATEGORIES } from '@/lib/api';

/**
 * 검색창 아래 가로 카테고리 — 네이버 메인 상단 메뉴 스타일.
 * 작은 아이콘 + 텍스트, 모바일은 가로 스크롤.
 */
export default function CategoryBar() {
  return (
    <nav className="catbar" aria-label="카테고리">
      <div className="catbar-inner">
        {CATEGORIES.map((c) => (
          <a key={c.name} className="catbar-item" href={`/category/${encodeURIComponent(c.name)}`}>
            <img src={`/img/${c.icon}`} alt="" loading="lazy" />
            <span>{c.name}</span>
          </a>
        ))}
        <a className="catbar-item catbar-item-magazine" href="/blog">
          <span className="catbar-magazine-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <path d="M9 7h7" />
              <path d="M9 11h7" />
            </svg>
          </span>
          <span>매거진</span>
        </a>
      </div>
    </nav>
  );
}
