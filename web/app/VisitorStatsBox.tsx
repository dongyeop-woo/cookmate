'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';

type Stats = { today: number; total: number } | null;

/**
 * 사이드바 박스 — 오늘 / 누적 방문자 표시.
 * 5분마다 자동 갱신.
 */
export default function VisitorStatsBox() {
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/web/stats`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setStats(data);
      } catch {}
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  return (
    <div className="side-box">
      <div className="side-header">
        <h3 className="side-title">방문자</h3>
      </div>
      <div className="visitor-stats">
        <div className="visitor-stat">
          <div className="visitor-stat-label">오늘</div>
          <div className="visitor-stat-value">
            {stats?.today?.toLocaleString() ?? '–'}
            <span className="visitor-stat-unit">명</span>
          </div>
        </div>
        <div className="visitor-stat-divider" />
        <div className="visitor-stat">
          <div className="visitor-stat-label">누적</div>
          <div className="visitor-stat-value">
            {stats?.total?.toLocaleString() ?? '–'}
            <span className="visitor-stat-unit">명</span>
          </div>
        </div>
      </div>
    </div>
  );
}
