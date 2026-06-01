import { Suspense } from 'react';
import OpenAppButton from './OpenAppButton';
import TopbarSearch from './TopbarSearch';

/**
 * 앱 홈 헤더: outline 로고 + 직접 입력 가능한 검색바 + 알림(앱 열기 fallback).
 */
export default function Topbar() {
  return (
    <header className="topbar">
      <a className="topbar-logo" href="/" aria-label="요잘알 홈">
        <img src="/img/appIcon-padded.png" alt="요잘알" />
      </a>
      <Suspense fallback={<div className="topbar-search" />}>
        <TopbarSearch />
      </Suspense>
      <OpenAppButton path="" className="topbar-bell" aria-label="알림">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      </OpenAppButton>
    </header>
  );
}
