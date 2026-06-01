import Link from 'next/link';
import { Recipe, diffColor } from '@/lib/api';

const FALLBACK = '/img/app-icon.png';

/**
 * 작은 레시피 카드 — 앱의 SmallRecipeCard 동일 디자인 (가로 스크롤용).
 * 정사각 이미지 + 제목 1줄 + ★평점·♥좋아요·작성자 + 난이도·시간·칼로리
 */
export default function SmallCard({ r }: { r: Recipe }) {
  const img = r.image && r.image.length > 0 ? r.image : FALLBACK;
  const rating = r.reviewAvgRating ?? r.rating ?? 0;
  return (
    <Link className="sm-card" href={`/recipe/${r.id}`}>
      <div className="sm-img-wrap">
        <img className="sm-img" src={img} alt={r.title} loading="lazy" />
      </div>
      <div className="sm-name">{r.title}</div>
      <div className="sm-meta">
        <span className="sm-star">★</span>
        <span>{rating.toFixed(1)}</span>
        <span className="sm-dot">·</span>
        <span className="sm-heart">♥</span>
        <span>{r.likes ?? 0}</span>
        {r.author && <>
          <span className="sm-dot">·</span>
          <span className="sm-author">{r.author}</span>
        </>}
      </div>
      <div className="sm-meta">
        <span className="sm-diff" style={{ color: diffColor(r.difficulty) }}>{r.difficulty ?? '쉬움'}</span>
        <span className="sm-dot">·</span>
        <span>⏱ {r.time}분</span>
        <span className="sm-dot">·</span>
        <span>{r.calories ?? 0}kcal</span>
      </div>
    </Link>
  );
}
