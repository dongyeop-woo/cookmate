import { Suspense } from 'react';
import TopbarSearch from './TopbarSearch';
import VisitorStatsBox from './VisitorStatsBox';
import CategoryBar from './CategoryBar';
import MobileLoginButton from './MobileLoginButton';

/**
 * 헤더: 방문자(우측) + (로고 + 검색바) + 카테고리 가로 줄.
 * 모바일은 방문자 좌측에 로그인 버튼 추가.
 */
export default function Topbar() {
  return (
    <>
      <div className="visitor-row">
        <MobileLoginButton />
        <VisitorStatsBox variant="bar" />
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
