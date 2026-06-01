import OpenAppButton from './OpenAppButton';

/**
 * 앱 홈 헤더: outline 로고 + 그라데이션 검색바 + 알림 (Ionicons notifications-outline).
 * 검색바 클릭 → /search 페이지 이동.
 */
export default function Topbar() {
  return (
    <header className="topbar">
      <a className="topbar-logo" href="/" aria-label="요잘알 홈">
        <img src="/img/appIcon-padded.png" alt="요잘알" />
      </a>
      <a className="topbar-search" href="/search" aria-label="레시피 검색">
        <span className="search-grad-wrap">
          <span className="search-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="search-placeholder">레시피 검색</span>
          </span>
        </span>
      </a>
      <OpenAppButton path="" className="topbar-bell" aria-label="알림">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </OpenAppButton>
    </header>
  );
}
