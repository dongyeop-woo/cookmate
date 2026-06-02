import { Suspense } from 'react';
import TopbarSearch from './TopbarSearch';
import VisitorStatsBox from './VisitorStatsBox';

/**
 * 헤더: 방문자 띠 + (outline 로고 + 검색바).
 */
export default function Topbar() {
  return (
    <>
      <VisitorStatsBox variant="bar" />
      <header className="topbar">
        <a className="topbar-logo" href="/" aria-label="요잘알 홈">
          <img src="/img/appIcon-padded.png" alt="요잘알" />
        </a>
        <Suspense fallback={<div className="topbar-search" />}>
          <TopbarSearch />
        </Suspense>
      </header>
    </>
  );
}
