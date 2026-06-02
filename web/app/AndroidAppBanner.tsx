'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'yj_android_banner_dismissed';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dyw.cookmate';

/**
 * 안드로이드 Chrome 에서만 표시되는 상단 앱 다운로드 배너.
 * iOS 는 Safari Smart App Banner (apple-itunes-app meta) 가 따로 띄워서 제외.
 * 닫으면 세션 내내 다시 안 띄움.
 */
export default function AndroidAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isInApp = /wv|; wv\)|WebView/i.test(ua); // 이미 앱 안에서 보는 경우 제외
    if (!isAndroid || isInApp) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {}
    setVisible(true);
  }, []);

  const handleOpen = () => {
    // 앱 설치돼 있으면 intent:// 가 앱 열고, 없으면 Play Store fallback.
    // 사용자가 직접 클릭한 경우라 Chrome 이 차단 안 함.
    const url = window.location.href.replace(/^https?:\/\//, '');
    const intentUrl = `intent://${url}#Intent;scheme=https;package=com.dyw.cookmate;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;
    window.location.href = intentUrl;
  };

  const handleClose = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

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
        <div className="aab-sub">Google Play 무료</div>
      </div>
      <button type="button" className="aab-open" onClick={handleOpen}>열기</button>
    </div>
  );
}
