import Link from 'next/link';
import ChefAvatar from './ChefAvatar';
import { Recipe, diffColor } from '@/lib/api';

const FALLBACK = '/img/app-icon.png';

type Props = { r: Recipe; authorImage?: string };

/**
 * 작은 레시피 카드 — 앱 SmallRecipeCard 와 동일.
 * 작성자 표시는 닉네임 + 프로필 아바타 (있으면 이미지, 없으면 첫 글자 placeholder)
 */
export default function SmallCard({ r, authorImage }: Props) {
  const img = r.image && r.image.length > 0 ? r.image : FALLBACK;
  const rating = r.reviewAvgRating ?? r.rating ?? 0;
  const initial = (r.author ?? '?').charAt(0).toUpperCase();

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
