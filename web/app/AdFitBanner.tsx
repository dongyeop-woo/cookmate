'use client';

import { useEffect, useRef, useState } from 'react';

const PC_ID = 'DAN-PxPrfiRVWpmBh8R1';
const MOBILE_ID = 'DAN-WIst3CCypa8GIv85';

/**
 * 카카오 AdFit 디스플레이 배너.
 * PC (≥769px): 728×90, 모바일: 320×100.
 * ins + ba.min.js 를 각 mount 시 컨테이너에 동적 주입 — Next.js
 * hydration 과 충돌 없이 화면 진입 시점에 광고 새로 로드.
 */
export default function AdFitBanner() {
  const [variant, setVariant] = useState<'pc' | 'mobile' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVariant(window.innerWidth <= 768 ? 'mobile' : 'pc');
  }, []);

  useEffect(() => {
    if (!variant || !containerRef.current) return;
    const container = containerRef.current;
    const isMobile = variant === 'mobile';

    container.innerHTML = '';

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', isMobile ? MOBILE_ID : PC_ID);
    ins.setAttribute('data-ad-width', isMobile ? '320' : '728');
    ins.setAttribute('data-ad-height', isMobile ? '100' : '90');
    container.appendChild(ins);

    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js';
    script.async = true;
    container.appendChild(script);
  }, [variant]);

  if (!variant) return <div className="adfit-banner" aria-hidden />;
  return <div ref={containerRef} className="adfit-banner" />;
}
