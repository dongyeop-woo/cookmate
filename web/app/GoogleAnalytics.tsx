import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-4REQHHF2YL';

/**
 * Google Analytics 4 (GA4) 통합.
 * NEXT_PUBLIC_GA_ID 환경변수가 있을 때만 활성화.
 * - 봇 자동 제외 (GA 내장 필터)
 * - 사람 방문자, 체류시간, 페이지뷰, 유입 경로 측정
 */
export default function GoogleAnalytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <Script
        id="ga-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { anonymize_ip: true });
          `,
        }}
      />
    </>
  );
}
