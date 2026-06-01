'use client';

import { ReactNode } from 'react';
import { STORE_URL } from '@/lib/api';

type Props = {
  path: string;
  className?: string;
  children: ReactNode;
};

/**
 * 앱 딥링크 열기 + 미설치 시 스토어로 fallback.
 * 카카오 인앱 브라우저는 deeplink가 안 먹어서 외부 브라우저 강제 오픈.
 */
export default function OpenAppButton({ path, className, children }: Props) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const ua = navigator.userAgent.toLowerCase();
    const isKakao = ua.indexOf('kakaotalk') > -1;
    const isAndroid = ua.indexOf('android') > -1;
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const storeUrl = isAndroid ? STORE_URL.android : STORE_URL.ios;
    const cleanPath = path.replace(/^yojalal:\/\//, '');

    if (isKakao) {
      if (isAndroid) {
        location.href = `intent://${cleanPath}#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=${encodeURIComponent(location.href)};end`;
      } else {
        location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
      }
    } else if (isAndroid) {
      location.href = `intent://${cleanPath}#Intent;scheme=yojalal;package=com.dyw.cookmate;S.browser_fallback_url=${encodeURIComponent(storeUrl)};end`;
    } else {
      location.href = `yojalal://${cleanPath}`;
      setTimeout(() => {
        if (document.visibilityState !== 'hidden') location.href = storeUrl;
      }, 1500);
    }
  };

  return (
    <a href={`yojalal://${path}`} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
