import type { Metadata } from 'next';
import Topbar from '../../Topbar';
import Footer from '../../Footer';
import CtaBanner from '../../CtaBanner';
import RecipeCard from '../../RecipeCard';
import { CATEGORIES, fetchRecipesByCategory } from '@/lib/api';

export const revalidate = 300;

// 빌드 시점에 알려진 카테고리만 정적 생성. 알 수 없는 카테고리는 런타임에서도 거부.
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ name: c.name }));
}

type Props = { params: { name: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeURIComponent(params.name);
  return {
    title: `${name} 레시피`,
    description: `${name} 카테고리의 레시피 모음 — 요잘알에서 단계별로 쉽게 만들어보세요.`,
    alternates: { canonical: `https://yojalal.com/category/${encodeURIComponent(name)}` },
    openGraph: { title: `${name} 레시피 — 요잘알`, description: `${name} 카테고리의 인기 레시피` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const name = decodeURIComponent(params.name);
  const cat = CATEGORIES.find((c) => c.name === name);
  const iconFile = cat?.icon ?? 'app-icon.png';

  let recipes = [];
  try { recipes = await fetchRecipesByCategory(name); } catch {}

  return (
    <>
      <Topbar />
      <main className="content">
        <section className="cat-hero">
          <div className="cat-hero-icon"><img src={`/img/${iconFile}`} alt={name} /></div>
          <h1 className="cat-hero-title">{name}</h1>
          <p className="cat-hero-sub">총 {recipes.length}개 레시피</p>
        </section>

        <section className="section">
          {recipes.length > 0 ? (
            <div className="recipe-grid">
              {recipes.map((r) => <RecipeCard key={r.id} r={r} />)}
            </div>
          ) : (
            <div className="empty">이 카테고리엔 아직 레시피가 없어요.</div>
          )}
        </section>
      </main>
      <Footer />
      <CtaBanner sub="단계별 자동 타이머 · 손 없이 요리" />
    </>
  );
}
