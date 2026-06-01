import Link from 'next/link';
import { Recipe, diffColor } from '@/lib/api';

const FALLBACK = '/img/app-icon.png';

/**
 * 베스트 레시피 카드 — 앱의 BestRecipeCard 와 동일한 디자인.
 * 다크 배경 + 이미지 풀필 + 하단 그라데이션 오버레이 + 정보 표시.
 */
export default function BestCard({ r }: { r: Recipe }) {
  const img = r.image && r.image.length > 0 ? r.image : FALLBACK;
  const rating = r.reviewAvgRating ?? r.rating ?? 0;
  const reviewCount = r.reviewCount ?? 0;
  return (
    <Link className="best-card" href={`/recipe/${r.id}`}>
      <img className="best-img" src={img} alt={r.title} loading="lazy" />
      <div className="best-grad" />
      <div className="best-info">
        <div className="best-cat">{r.category ?? ''}</div>
        <div className="best-title-row">
          <div className="best-title">{r.title}</div>
          <div className="best-rating">
            ★ {rating.toFixed(1)} ({reviewCount > 99 ? '99+' : reviewCount})
          </div>
        </div>
        <div className="best-meta">
          <span className="best-heart">♥ {r.likes ?? 0}</span>
          <span className="best-time">⏱ {r.time}분</span>
          <span className="best-diff" style={{ color: diffColor(r.difficulty) }}>
            {r.difficulty ?? '쉬움'}
          </span>
          <span className="best-author">{r.author ?? ''}</span>
        </div>
      </div>
    </Link>
  );
}
