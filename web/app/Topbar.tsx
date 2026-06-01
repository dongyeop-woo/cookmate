import OpenAppButton from './OpenAppButton';

/**
 * 앱 홈 헤더 그대로 옮김: 로고 아이콘 + 그라데이션 검색바 + 알림(앱 열기 fallback).
 * 검색바는 앱의 검색 화면이 있어야 동작하므로 웹에선 앱 열기로 fallback.
 */
export default function Topbar() {
  return (
    <header className="topbar">
      <a className="topbar-logo" href="/">
        <img src="/img/app-icon.png" alt="요잘알" />
      </a>
      <OpenAppButton path="search" className="topbar-search">
        <span className="search-grad-wrap">
          <span className="search-inner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="search-placeholder">레시피 검색</span>
          </span>
        </span>
      </OpenAppButton>
      <OpenAppButton path="" className="topbar-bell">🔔</OpenAppButton>
    </header>
  );
}
