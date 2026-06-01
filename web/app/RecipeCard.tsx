import Link from 'next/link';
import { Recipe, formatTime, diffColor } from '@/lib/api';

const FALLBACK = '/img/app-icon.png';

export default function RecipeCard({ r }: { r: Recipe }) {
  const img = r.image && r.image.length > 0 ? r.image : FALLBACK;
  return (
    <Link className="recipe-card" href={`/recipe/${r.id}`}>
      <div className="thumb-wrap">
        <img className="thumb" src={img} alt={r.title} loading="lazy" />
        {r.author && <span className="author-overlay">{r.author}</span>}
      </div>
      <div className="name">{r.title}</div>
      <div className="meta">
        <span>{formatTime(r.time)}분</span>
        <span className="sep">·</span>
        <span className="diff" style={{ color: diffColor(r.difficulty) }}>
          {r.difficulty ?? '쉬움'}
        </span>
        <span className="sep">·</span>
        <span className="heart">♥ {r.likes ?? 0}</span>
      </div>
    </Link>
  );
}
