import Topbar from './Topbar';
import Footer from './Footer';
import CtaBanner from './CtaBanner';
import BestCard from './BestCard';
import SmallCard from './SmallCard';
import Hscroll from './Hscroll';
import { CATEGORIES, fetchHomeSections } from '@/lib/api';

export const revalidate = 300; // 5분 ISR

export default async function HomePage() {
  const { best, recommended, quick, snack, weekly } = await fetchHomeSections();

  return (
    <>
      <Topbar />
      <main>
        {/* 카테고리 */}
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <a key={c.name} className="cat-item" href={`/category/${encodeURIComponent(c.name)}`}>
              <span className="cat-icon">
                <img src={`/img/${c.icon}`} alt={c.name} loading="lazy" />
              </span>
              <span className="cat-label">{c.name}</span>
            </a>
          ))}
        </div>

        {/* 베스트 레시피 */}
        {best.length > 0 && (
          <>
            <div className="section-header"><h2 className="section-title">베스트 레시피</h2></div>
            <Hscroll>
              {best.map((r) => <BestCard key={r.id} r={r} />)}
            </Hscroll>
          </>
        )}

        {/* 추천 레시피 */}
        {recommended.length > 0 && (
          <>
            <div className="section-header"><h2 className="section-title">추천 레시피</h2></div>
            <Hscroll>
              {recommended.map((r) => <SmallCard key={r.id} r={r} />)}
            </Hscroll>
          </>
        )}

        {/* 초스피드 요리 */}
        {quick.length > 0 && (
          <>
            <div className="section-header"><h2 className="section-title">초스피드 요리</h2></div>
            <Hscroll>
              {quick.map((r) => <SmallCard key={r.id} r={r} />)}
            </Hscroll>
          </>
        )}

        {/* 인기 간식 */}
        {snack.length > 0 && (
          <>
            <div className="section-header"><h2 className="section-title">인기 간식</h2></div>
            <Hscroll>
              {snack.map((r) => <SmallCard key={r.id} r={r} />)}
            </Hscroll>
          </>
        )}

        {/* 이번 주 레시피 */}
        {weekly.length > 0 && (
          <>
            <div className="section-header"><h2 className="section-title">이번 주 레시피</h2></div>
            <Hscroll>
              {weekly.map((r) => <SmallCard key={r.id} r={r} />)}
            </Hscroll>
          </>
        )}
      </main>
      <Footer />
      <CtaBanner />
    </>
  );
}
