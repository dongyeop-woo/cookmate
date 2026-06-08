import Topbar from './Topbar';
import Footer from './Footer';
import BestCard from './BestCard';
import SmallCard from './SmallCard';
import Hscroll from './Hscroll';
import Sidebar from './Sidebar';
import AdFitBanner from './AdFitBanner';
import { CATEGORIES, fetchHomeSections, fetchTopUsers, fetchAuthorImageMap, fetchTopViewedRecipes } from '@/lib/api';

export const runtime = 'edge';
export const revalidate = 300;

export default async function HomePage() {
  const [sections, authorImages, topUsersRaw, topViewed] = await Promise.all([
    fetchHomeSections(),
    fetchAuthorImageMap(),
    fetchTopUsers(8),
    fetchTopViewedRecipes(5),
  ]);
  const { best, recommended, quick, snack, weekly } = sections;
  const popular = best.slice(0, 5);

  // admin 작성자는 백엔드 recipeCount 가 0 인 채로 있어서
  // 일반 레시피 author 매칭 카운트와 최댓값으로 보정.
  const recipeCountByAuthor = new Map<string, number>();
  for (const r of sections.recipes) {
    if (!r.author) continue;
    recipeCountByAuthor.set(r.author, (recipeCountByAuthor.get(r.author) ?? 0) + 1);
  }
  const topUsers = topUsersRaw.map((u) => ({
    ...u,
    recipeCount: Math.max(
      u.recipeCount ?? 0,
      u.nickname ? (recipeCountByAuthor.get(u.nickname) ?? 0) : 0,
    ),
  }));

  return (
    <>
      <Topbar />
      <div className="portal-layout">
        <main className="portal-main">
          {/* 카테고리 (모바일 전용) */}
          <div className="cat-grid cat-grid-mobile">
            {CATEGORIES.map((c) => (
              <a key={c.name} className="cat-item" href={`/category/${encodeURIComponent(c.name)}`}>
                <span className="cat-icon">
                  <img src={`/img/${c.icon}`} alt={c.name} loading="lazy" />
                </span>
                <span className="cat-label">{c.name}</span>
              </a>
            ))}
          </div>

          {best.length > 0 && (
            <Hscroll title="베스트 레시피">
              {best.map((r) => <BestCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </Hscroll>
          )}

          <AdFitBanner />

          {recommended.length > 0 && (
            <Hscroll title="추천 레시피">
              {recommended.map((r) => <SmallCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </Hscroll>
          )}

          {quick.length > 0 && (
            <Hscroll title="초스피드 요리" subtitle="15분 이하">
              {quick.map((r) => <SmallCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </Hscroll>
          )}

          {snack.length > 0 && (
            <Hscroll title="인기 간식">
              {snack.map((r) => <SmallCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </Hscroll>
          )}

          {weekly.length > 0 && (
            <Hscroll title="이번 주 레시피">
              {weekly.map((r) => <SmallCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </Hscroll>
          )}
        </main>

        <Sidebar topViewed={topViewed} popular={popular} topUsers={topUsers} authorImages={authorImages} />
      </div>
      <Footer />
    </>
  );
}
