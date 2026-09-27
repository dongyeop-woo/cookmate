import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Topbar from '../../Topbar';
import Footer from '../../Footer';
import ChefAvatar from '../../ChefAvatar';
import RecipeViewTracker from '../../RecipeViewTracker';
import AdFitBanner from '../../AdFitBanner';
import LikeButton from '../../LikeButton';
import CtaBanner from '../../CtaBanner';
import { fetchRecipe, fetchAuthorImageMap, fetchRecipeViewCount, Recipe, formatTime, diffColor } from '@/lib/api';

export const runtime = 'edge';
export const revalidate = 300;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await fetchRecipe(id);
  if (!r) return { title: '레시피를 찾을 수 없습니다', robots: { index: false } };
  // 검색 결과에서 고를 근거를 준다. 네이버 기준 노출 1,471회에 클릭 3회
  // (CTR 0.2%) 였던 '카츠동 레시피 — 요잘알' 이 문제였다. 경쟁 블로그 글은
  // 제목에 시간·난이도가 들어가는데 우리는 요리 이름뿐이었다.
  //
  // '레시피' 대신 '만드는 법' 을 쓴다 — 사람들이 실제로 치는 말이라 검색어와
  // 제목이 겹쳐 굵게 표시된다.
  const mins = formatTime(r.time);
  const spec = [
    mins ? `${mins}분` : null,
    r.difficulty ?? null,
    r.calories ? `${r.calories}kcal` : null,
    r.ingredients?.length ? `재료 ${r.ingredients.length}개` : null,
  ].filter(Boolean).join(' · ');

  const body = r.description?.replace(/<[^>]+>/g, '').trim() ?? '';
  // 설명 앞에 스펙을 붙인다. 검색 결과에서 사람들이 먼저 보는 건 감성 카피가
  // 아니라 "얼마나 걸리나, 어려운가" 다.
  const desc = `${spec}. ${body}`.trim().slice(0, 155);

  return {
    title: `${r.title} 만드는 법${mins ? ` · ${mins}분` : ''}`,
    description: desc,
    alternates: { canonical: `https://yojalal.com/recipe/${id}` },
    openGraph: {
      title: `${r.title} — 요잘알`,
      description: desc,
      images: r.image ? [r.image] : ['/img/app-icon.png'],
    },
    twitter: {
      title: `${r.title} — 요잘알`,
      description: desc,
      images: r.image ? [r.image] : ['/img/app-icon.png'],
    },
  };
}

function jsonLd(r: Recipe, id: string) {
  const totalMin = Math.max(1, Math.round(r.time));
  const recipeUrl = `https://yojalal.com/recipe/${id}`;
  const fallbackImg = 'https://yojalal.com/img/app-icon.png';

  const keywordList = [
    ...(r.tags ?? []),
    r.category,
    r.difficulty,
    r.author,
  ].filter((v): v is string => !!v && v.trim().length > 0);

  return {
    '@context': 'https://schema.org/',
    '@type': 'Recipe',
    name: r.title,
    image: r.image ? [r.image] : [fallbackImg],
    author: { '@type': 'Person', name: r.author ?? '요잘알' },
    description: r.description?.replace(/<[^>]+>/g, '').slice(0, 200) ?? `${r.title} 레시피`,
    keywords: keywordList.length > 0 ? keywordList.join(', ') : `${r.title}, 레시피, ${r.category ?? '한식'}`,
    recipeCategory: r.category ?? '한식',
    recipeCuisine: '한식',
    totalTime: `PT${totalMin}M`,
    recipeYield: `${r.servings ?? '1'}인분`,
    nutrition: { '@type': 'NutritionInformation', calories: `${r.calories ?? 0} kcal` },
    recipeIngredient: (r.ingredients ?? []).map((i) =>
      `${i.name ?? ''} ${i.amount ?? ''}`.trim()
    ),
    recipeInstructions: (r.steps ?? []).map((s, i) => {
      const pos = s.step ?? i + 1;
      const stepImg = s.imageUrl && !s.imageUrl.startsWith('file://') ? s.imageUrl : fallbackImg;
      return {
        '@type': 'HowToStep',
        position: pos,
        name: `${pos}단계`,
        text: s.description ?? '',
        url: `${recipeUrl}#step-${pos}`,
        image: stepImg,
      };
    }),
    url: recipeUrl,
    ...((r.reviewAvgRating ?? r.rating ?? 0) > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (r.reviewAvgRating ?? r.rating ?? 0).toFixed(1),
            reviewCount: String(Math.max(1, r.reviewCount ?? r.likes ?? 1)),
          },
        }
      : {}),
  };
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const r = await fetchRecipe(id);
  if (!r) notFound();
  let authorImages: Record<string, string> = {};
  let viewCount = 0;
  try { authorImages = await fetchAuthorImageMap(); } catch {}
  try { viewCount = await fetchRecipeViewCount(id); } catch {}

  const heroImg = r.image && r.image.length > 0 ? r.image : '/img/app-icon.png';
  const authorImage = r.author ? authorImages[r.author] : undefined;
  const ingredients = r.ingredients ?? [];
  const steps = r.steps ?? [];

  return (
    <>
      <RecipeViewTracker id={id} />
      <Topbar />
      <img className="hero-img" src={heroImg} alt={r.title} />
      <main className="detail">
        <h1 className="title">{r.title}</h1>

        <div className="stat-row">
          <span>
            <span className="star">★</span> {(r.reviewAvgRating ?? r.rating ?? 0).toFixed(1)}
            {' '}<span className="rating-count">({(r.reviewCount ?? 0) > 99 ? '99+' : r.reviewCount ?? 0})</span>
          </span>
          <LikeButton recipeId={id} initialLikes={r.likes ?? 0} />
          <span className="stat-views">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {viewCount.toLocaleString()}
          </span>
        </div>

        <div className="author">
          <ChefAvatar className="avatar avatar-img" profileImage={authorImage} alt={r.author ?? ''} />
          <span>{r.author ?? '요잘알'}</span>
        </div>

        <div className="info-row">
          <div className="info-item">
            <div className="info-num">{formatTime(r.time)}<span className="unit">분</span></div>
            <div className="info-label">시간</div>
          </div>
          <div className="info-item">
            <div className="info-num" style={{ color: diffColor(r.difficulty) }}>
              {r.difficulty ?? '쉬움'}
            </div>
            <div className="info-label">난이도</div>
          </div>
          <div className="info-item">
            <div className="info-num">{r.calories ?? 0}<span className="unit">kcal</span></div>
            <div className="info-label">칼로리</div>
          </div>
          <div className="info-item">
            <div className="info-num">{String(r.servings ?? '1')}<span className="unit">인분</span></div>
            <div className="info-label">분량</div>
          </div>
        </div>

        {r.description && (
          <section className="section">
            <h2 className="section-title">소개</h2>
            <p className="desc">{r.description}</p>
            {r.tags && r.tags.length > 0 && (
              <div className="tags">
                {r.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
              </div>
            )}
          </section>
        )}

        <section className="section">
          <h2 className="section-title">재료</h2>
          {ingredients.length > 0 ? (
            <>
              {ingredients.map((i, idx) => (
                <div key={idx} className="ingredient">
                  <span className="name">{i.name}</span>
                  <span className="ingredient-right">
                    <span className="amount">{i.amount}</span>
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className="empty">재료 정보가 없습니다.</div>
          )}
        </section>

        <AdFitBanner />

        <section className="section">
          <h2 className="section-title">조리 순서</h2>
          {steps.length > 0 ? (
            steps.map((s, idx) => {
              const t = (s.time ?? 0) >= 1
                ? `${formatTime(s.time!)}분`
                : Math.round((s.time ?? 0) * 60) + '초';
              const pos = s.step ?? idx + 1;
              return (
                <div key={idx} id={`step-${pos}`} className="step">
                  <div className="step-num">{pos}</div>
                  <div className="step-body">
                    {s.imageUrl && !s.imageUrl.startsWith('file://') && (
                      <img className="step-photo" src={s.imageUrl} alt={`step ${idx + 1}`} loading="lazy" />
                    )}
                    <p className="step-desc">{s.description}</p>
                    {(s.time ?? 0) > 0 && <div className="step-time">⏱ {t}</div>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty">조리 순서 정보가 없습니다.</div>
          )}
        </section>
      </main>

      <Footer />

      <CtaBanner
        title={`${r.title}, 앱에서 만들기`}
        sub="단계별 자동 타이머 · 음성 모드"
        path={`recipe/${id}`}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(r, id)) }}
      />
    </>
  );
}
