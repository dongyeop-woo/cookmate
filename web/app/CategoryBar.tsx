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
      </div>
    </nav>
  );
}
