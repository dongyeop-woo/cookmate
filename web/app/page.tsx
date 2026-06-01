import Topbar from './Topbar';
import Footer from './Footer';
import CtaBanner from './CtaBanner';
import RecipeCard from './RecipeCard';
import { CATEGORIES, fetchPopularRecipes } from '@/lib/api';

export const revalidate = 300; // 5분 ISR — 신규 레시피 등록 시 5분 내 반영.

export default async function HomePage() {
  // 정적 빌드에서도 빌드 시점 데이터 fetch. 실패해도 빈 배열로 렌더.
  let popular = [];
  try { popular = await fetchPopularRecipes(12); } catch {}

  return (
    <>
      <Topbar />
      <main className="content">
        <section className="hero">
          <h1 className="hero-title">
            오늘 뭐 먹지?<br />
            <span className="hero-accent">고민, 이제 끝.</span>
          </h1>
          <p className="hero-sub">
            10개 카테고리 검증 레시피와<br />
            단계별 자동 타이머로 누구나 쉽게.
          </p>
        </section>

        <section className="section">
          <div className="section-header"><h2 className="section-title">카테고리</h2></div>
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
        </section>

        <section className="section">
          <div className="section-header"><h2 className="section-title">인기 레시피</h2></div>
          {popular.length > 0 ? (
            <div className="recipe-grid">
              {popular.map((r) => <RecipeCard key={r.id} r={r} />)}
            </div>
          ) : (
            <div className="empty">레시피를 불러오지 못했어요.</div>
          )}
        </section>
      </main>
      <Footer />
      <CtaBanner />
    </>
  );
}
