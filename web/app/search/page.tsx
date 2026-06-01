import type { Metadata } from 'next';
import Topbar from '../Topbar';
import Footer from '../Footer';
import RecipeCard from '../RecipeCard';
import { fetchAllRecipes, fetchAuthorImageMap } from '@/lib/api';

// Cloudflare Pages 는 동적 라우트가 Edge Runtime 사용해야 함.
export const runtime = 'edge';
export const revalidate = 300;

export const metadata: Metadata = {
  title: '레시피 검색',
  description: '요잘알에서 원하는 레시피를 검색하세요.',
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let all: Awaited<ReturnType<typeof fetchAllRecipes>> = [];
  let authorImages: Record<string, string> = {};
  try {
    [all, authorImages] = await Promise.all([
      fetchAllRecipes(),
      fetchAuthorImageMap(),
    ]);
  } catch {}

  const results = q
    ? all.filter((r) => {
        const hay = [
          r.title,
          r.author,
          r.category,
          r.description,
          ...(r.tags ?? []),
          ...(r.ingredients ?? []).map((i) => i.name),
        ].join(' ').toLowerCase();
        return hay.includes(q);
      })
    : [];

  return (
    <>
      <Topbar />
      <main>
        {q ? (
          <>
            <div className="section-header">
              <h2 className="section-title">"{q}" 검색 결과 ({results.length})</h2>
            </div>
            {results.length > 0 ? (
              <div className="recipe-grid">
                {results.map((r) => <RecipeCard key={r.id} r={r} authorImage={r.author ? authorImages[r.author] : undefined} />)}
              </div>
            ) : (
              <div className="empty">검색 결과가 없어요.<br />다른 키워드로 시도해보세요.</div>
            )}
          </>
        ) : (
          <div className="empty">위 검색창에 레시피 이름, 재료, 카테고리를 입력해보세요.</div>
        )}
      </main>
      <Footer />
    </>
  );
}
