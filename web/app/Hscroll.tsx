'use client';

import { ReactNode, useRef } from 'react';

/**
 * 가로 스크롤 래퍼 — 좌우 화살표 버튼 포함.
 * 데스크톱: 호버 시 양쪽 화살표 노출, 클릭하면 한 화면씩 스크롤.
 * 모바일: 화살표 숨김, 터치 스와이프 그대로.
 */
export default function Hscroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.85) * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="hscroll-wrap">
      <button
        type="button"
        className="hscroll-btn hscroll-btn-prev"
        aria-label="이전"
        onClick={() => scroll(-1)}
      >‹</button>
      <div className="hscroll" ref={ref}>
        {children}
      </div>
      <button
        type="button"
        className="hscroll-btn hscroll-btn-next"
        aria-label="다음"
        onClick={() => scroll(1)}
      >›</button>
    </div>
  );
}
