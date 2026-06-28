import type { Metadata } from 'next';
import Link from 'next/link';
import Topbar from '../Topbar';
import Footer from '../Footer';
import BlogListViews from '../BlogListViews';
import { getAllPosts } from '@/lib/blog';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: '요잘알 매거진',
  description: '오늘 뭐 먹지? 매일 새로운 요리 가이드, 트렌드 레시피, 영양 정보, 살림 팁.',
  alternates: { canonical: 'https://yojalal.com/blog' },
  openGraph: {
    title: '요잘알 매거진 — 매일 새로운 요리 가이드',
    description: '오늘 뭐 먹지? 매일 새로운 요리 가이드, 트렌드 레시피, 영양 정보, 살림 팁.',
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  return (
    <>
      <Topbar />
      <main className="content">
        <section className="blog-hero">
          <h1 className="blog-hero-title">요잘알 매거진</h1>
          <p className="blog-hero-sub">매일 새로운 요리 가이드 · 트렌드 레시피 · 영양 정보</p>
        </section>

        <section className="section">
          {posts.length > 0 ? (
            <ul className="blog-list">
              {posts.map((p) => (
                <li key={p.slug} className="blog-list-item">
                  <Link className="blog-card" href={`/blog/${encodeURIComponent(p.slug)}`}>
                    {p.image && (
                      <div className="blog-card-img">
                        <img src={p.image} alt={p.title} loading="lazy" />
                      </div>
                    )}
                    <div className="blog-card-body">
                      <div className="blog-card-date">
                        <span>{p.date}</span>
                        <BlogListViews slug={p.slug} />
                      </div>
                      <h2 className="blog-card-title">{p.title}</h2>
                      <p className="blog-card-desc">{p.description}</p>
                      {p.tags.length > 0 && (
                        <div className="blog-card-tags">
                          {p.tags.slice(0, 4).map((t) => <span key={t} className="blog-card-tag">#{t}</span>)}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">아직 발행된 글이 없어요. 곧 매일 새 글이 올라옵니다.</div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
