import Link from 'next/link';
import ChefAvatar from './ChefAvatar';
import { Recipe, diffColor } from '@/lib/api';

const FALLBACK = '/img/app-icon.png';

/**
 * 그리드 셀로 쓰는 레시피 카드 — SmallCard 와 동일 구조.
 * 카테고리·검색 페이지 등 2열/4열 그리드에서 사용.
 */
export default function RecipeCard({ r, authorImage }: { r: Recipe; authorImage?: string }) {
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
        {r.author && (
          <>
            <span className="sm-dot">·</span>
            <span className="sm-author-wrap">
              <ChefAvatar className="sm-author-avatar" profileImage={authorImage} alt={r.author} />
              <span className="sm-author">{r.author}</span>
            </span>
          </>
        )}
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
