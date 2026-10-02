'use client';

import { useEffect } from 'react';
import { API_BASE } from '@/lib/api';

/**
 * 페이지 방문 1회 기록. 같은 세션(=브라우저 세션) 내 중복 카운트 방지.
 * sessionStorage 사용 — 탭 닫으면 사라짐 (= 다음 세션엔 다시 카운트).
 *
 * 밖에서 어떻게 들어왔는지는 document.referrer 로만 알 수 있다. 서버가 보는
 * Referer 헤더는 이 fetch 를 띄운 '현재 페이지' 라 전부 yojalal.com 이 된다.
 * 그래서 값을 직접 실어 보낸다 (분류는 서버에서).
 */
export default function VisitTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = 'yj_visited_session';
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      const ref = document.referrer || '';
      const qs = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      fetch(`${API_BASE}/api/web/visit${qs}`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
