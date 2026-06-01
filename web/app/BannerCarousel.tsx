'use client';

import { useEffect, useRef, useState } from 'react';
import OpenAppButton from './OpenAppButton';

// 웹에서는 요잘알 리뷰 이벤트 배너만 노출. 다른 이벤트는 앱 내에서만.
const BANNERS = [
  { image: '/img/test.png', path: 'event-review' },
];

const INTERVAL = 5000;

/**
 * 앱 StackAdCard 와 동일한 카루셀 — 좌우 14px peek + 6px gap.
 * 텍스트/오버레이 없이 이미지만 깔끔히. 5초 자동 전환.
 */
export default function BannerCarousel() {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const slide = el.children[i] as HTMLElement | undefined;
    if (slide) el.scrollTo({ left: slide.offsetLeft - 14, behavior: 'smooth' });
  };

  // 자동 전환
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % BANNERS.length;
        goTo(next);
        return next;
      });
    }, INTERVAL);
    return () => clearInterval(t);
  }, []);

  // 사용자 스크롤(스와이프)에 따른 활성 점 동기화
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const slideW = (el.children[0] as HTMLElement)?.clientWidth ?? 1;
        const next = Math.round(el.scrollLeft / (slideW + 6));
        setIdx(Math.min(BANNERS.length - 1, Math.max(0, next)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const multi = BANNERS.length > 1;

  return (
    <div className="banner-wrap">
      <div className="banner-viewport" ref={ref}>
        {BANNERS.map((b, i) => (
          <OpenAppButton key={i} path={b.path} className="banner-slide">
            <img src={b.image} alt="" className="banner-img" loading={i === 0 ? 'eager' : 'lazy'} />
          </OpenAppButton>
        ))}
      </div>
      {multi && (
        <div className="banner-dots">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`banner-dot ${i === idx ? 'active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`배너 ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
