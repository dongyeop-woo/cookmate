'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'yj_app_banner_dismissed_v2';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.dyw.cookmate';
const APP_STORE_URL = 'https://apps.apple.com/kr/app/%EC%9A%94%EC%9E%98%EC%95%8C/id6761661890';

type OS = 'ios' | 'android' | null;

/**
 * 모바일 웹 상단 앱 다운로드 배너.
 * iOS → App Store, Android → intent:// (앱 설치 시 앱 열기, 없으면 Play Store)
 * 데스크탑/in-app WebView 에선 표시 안 함.
 */
export default function AndroidAppBanner() {
  const [os, setOs] = useState<OS>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/i.test(ua);
    // in-app WebView 만 정확히 매칭 (일반 Chrome 잘못 거르지 않게)
    const isInApp = /;\s*wv\)/i.test(ua);
    if (isInApp) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {}
    if (isAndroid) setOs('android');
    else if (isIOS) setOs('ios');
  }, []);

  const handleOpen = () => {
    if (os === 'android') {
      const url = window.location.href.replace(/^https?:\/\//, '');
      const intentUrl =
        `intent://${url}#Intent;scheme=https;package=com.dyw.cookmate;` +
        `S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`;
      window.location.href = intentUrl;
    } else if (os === 'ios') {
      window.location.href = APP_STORE_URL;
    }
  };

  const handleClose = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setOs(null);
  };

  if (!os) return null;

  const storeLabel = os === 'android' ? 'Google Play 무료' : 'App Store 무료';

  return (
    <div className="aab" role="banner" aria-label="요잘알 앱 설치 권유">
      <button type="button" className="aab-close" onClick={handleClose} aria-label="배너 닫기">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <img className="aab-icon" src="/img/appIcon-padded.png" alt="" />
      <div className="aab-text">
        <div className="aab-title">요잘알</div>
        <div className="aab-sub">{storeLabel}</div>
      </div>
      <button type="button" className="aab-open" onClick={handleOpen}>열기</button>
    </div>
  );
}
