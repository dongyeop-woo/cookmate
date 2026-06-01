'use client';

import { useEffect } from 'react';
import { API_BASE } from '@/lib/api';

/**
 * 페이지 방문 1회 기록. 같은 세션(=브라우저 세션) 내 중복 카운트 방지.
 * sessionStorage 사용 — 탭 닫으면 사라짐 (= 다음 세션엔 다시 카운트).
 */
export default function VisitTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const key = 'yj_visited_session';
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      fetch(`${API_BASE}/api/web/visit`, {
        method: 'POST',
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
