'use client';

import { ReactNode, useRef } from 'react';

type Props = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * 가로 스크롤 섹션 — 제목 + 우측 화살표 + 가로 스크롤.
 * 데스크톱: 헤더 우측에 < > 버튼.
 * 모바일: 화살표 숨김, 터치 스와이프.
 */
export default function Hscroll({ title, subtitle, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.85) * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="portal-box">
      {title && (
        <div className="portal-box-header">
          <h2 className="portal-box-title">{title}</h2>
          {subtitle && <span className="portal-box-sub">{subtitle}</span>}
          <div className="portal-box-arrows">
            <button type="button" className="portal-arrow" aria-label="이전" onClick={() => scroll(-1)}>‹</button>
            <button type="button" className="portal-arrow" aria-label="다음" onClick={() => scroll(1)}>›</button>
          </div>
        </div>
      )}
      <div className="hscroll" ref={ref}>
        {children}
      </div>
    </section>
  );
}
