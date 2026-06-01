import Topbar from './Topbar';
import Footer from './Footer';
import CtaBanner from './CtaBanner';
import BestCard from './BestCard';
import SmallCard from './SmallCard';
import Hscroll from './Hscroll';
import Sidebar from './Sidebar';
import BannerCarousel from './BannerCarousel';
import { CATEGORIES, fetchHomeSections, fetchTopUsers, fetchAuthorImageMap } from '@/lib/api';

export const revalidate = 300;

export default async function HomePage() {
  const [sections, authorImages, topUsers] = await Promise.all([
    fetchHomeSections(),
    fetchAuthorImageMap(),
    fetchTopUsers(8),
  ]);
  const { best, recommended, quick, snack, weekly } = sections;
  const todayPick = recommended.slice(0, 5);
  const popular = best.slice(0, 5);

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

          <BannerCarousel />

          {best.length > 0 && (
            <Hscroll title="베스트 레시피">
              {best.map((r) => <BestCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </Hscroll>
          )}

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

        <Sidebar todayPick={todayPick} popular={popular} topUsers={topUsers} authorImages={authorImages} />
      </div>
      <Footer />
      <CtaBanner />
    </>
  );
}
