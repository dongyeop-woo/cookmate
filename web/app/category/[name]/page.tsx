import type { Metadata } from 'next';
import Topbar from '../../Topbar';
import Footer from '../../Footer';
import RecipeCard from '../../RecipeCard';
import { CATEGORIES, fetchRecipesByCategory, fetchAuthorImageMap } from '@/lib/api';

// Cloudflare Pages 가 한글 URL 정적 페이지 못 찾는 이슈 → Edge runtime 으로 동적 렌더링.
export const runtime = 'edge';
export const revalidate = 300;

type Props = { params: Promise<{ name: string }> };

/** 이미 디코딩됐을 수 있는 한글 URL 안전 처리. */
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name: raw } = await params;
  const name = safeDecode(raw);
  return {
    title: `${name} 레시피`,
    description: `${name} 카테고리의 레시피 모음 — 요잘알에서 단계별로 쉽게 만들어보세요.`,
    alternates: { canonical: `https://yojalal.com/category/${encodeURIComponent(name)}` },
    openGraph: { title: `${name} 레시피 — 요잘알`, description: `${name} 카테고리의 인기 레시피` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { name: raw } = await params;
  const name = safeDecode(raw);
  const cat = CATEGORIES.find((c) => c.name === name);
  const iconFile = cat?.icon ?? 'app-icon.png';

  let recipes: Awaited<ReturnType<typeof fetchRecipesByCategory>> = [];
  let authorImages: Record<string, string> = {};
  try { recipes = await fetchRecipesByCategory(name); } catch {}
  try { authorImages = await fetchAuthorImageMap(); } catch {}

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
              {recipes.map((r) => <RecipeCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
            </div>
          ) : (
            <div className="empty">이 카테고리엔 아직 레시피가 없어요.</div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
