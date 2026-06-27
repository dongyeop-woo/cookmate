import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from './AuthProvider';
import VisitTracker from './VisitTracker';
import GoogleAnalytics from './GoogleAnalytics';

export const metadata: Metadata = {
  metadataBase: new URL('https://yojalal.com'),
  title: { default: '요잘알 — 오늘 뭐 먹지?', template: '%s — 요잘알' },
  description:
    '오늘 뭐 먹지? 고민 끝. 10개 카테고리 검증 레시피와 단계별 자동 타이머로 누구나 쉽게.',
  themeColor: '#0B9A61',
  openGraph: {
    type: 'website',
    siteName: '요잘알',
    images: ['/img/app-icon.png'],
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/img/app-icon.png' },
  // iOS Safari Smart App Banner 는 자체 배너(AndroidAppBanner)와 중복되어 제거.
  other: {
    'naver-site-verification': 'f3ce9d08e93e4c40d2c94e866fce037a85f9b733',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8542314434357214"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <GoogleAnalytics />
          <VisitTracker />
          <div className="page">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
