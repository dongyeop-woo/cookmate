'use client';

import { useEffect, useState } from 'react';

/**
 * 쿠팡 파트너스 다이내믹 배너.
 * PC (≥769px): 680x140 (id 995495), 모바일: 320x100 (id 995496).
 * Next.js hydration 과 충돌 없게 iframe srcDoc 으로 격리.
 */

const PC_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style></head><body><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":995495,"template":"carousel","trackingCode":"AF8701960","width":"680","height":"140","tsource":""});</script></body></html>`;

const MOBILE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden;}</style></head><body><script src="https://ads-partners.coupang.com/g.js"></script><script>new PartnersCoupang.G({"id":995496,"template":"carousel","trackingCode":"AF8701960","width":"320","height":"100","tsource":""});</script></body></html>`;

export default function CoupangBanner() {
  const [variant, setVariant] = useState<'pc' | 'mobile' | null>(null);

  useEffect(() => {
    setVariant(window.innerWidth <= 768 ? 'mobile' : 'pc');
  }, []);

  if (!variant) return null;
  const isMobile = variant === 'mobile';

  return (
    <div className="coupang-banner">
      <iframe
        title="요잘알 추천 상품"
        srcDoc={isMobile ? MOBILE_HTML : PC_HTML}
        width={isMobile ? 320 : 680}
        height={isMobile ? 100 : 140}
        scrolling="no"
        frameBorder={0}
        loading="lazy"
      />
    </div>
  );
}
