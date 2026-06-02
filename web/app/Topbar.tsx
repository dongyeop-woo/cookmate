import { Suspense } from 'react';
import TopbarSearch from './TopbarSearch';
import VisitorStatsBox from './VisitorStatsBox';
import CategoryBar from './CategoryBar';
import MobileLoginButton from './MobileLoginButton';
import AppDownloadModal from './AppDownloadModal';

/**
 * 헤더: 앱 다운로드(좌측) + 방문자/로그인(우측) + (로고 + 검색바) + 카테고리.
 */
export default function Topbar() {
  return (
    <>
      <div className="visitor-row">
        <AppDownloadModal className="topbar-app-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          앱 다운로드
        </AppDownloadModal>
        <div className="visitor-row-right">
          <MobileLoginButton />
          <VisitorStatsBox variant="bar" />
        </div>
      </div>
      <header className="topbar">
        <a className="topbar-logo" href="/" aria-label="요잘알 홈">
          <img src="/img/appIcon-padded.png" alt="요잘알" />
        </a>
        <Suspense fallback={<div className="topbar-search" />}>
          <TopbarSearch />
        </Suspense>
      </header>
      <CategoryBar />
    </>
  );
}
