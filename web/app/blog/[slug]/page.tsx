import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Topbar from '../../Topbar';
import Footer from '../../Footer';
import { getAllSlugs, loadPost } from '@/lib/blog';

export const dynamic = 'force-static';

type Props = { params: Promise<{ slug: string }> };

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = safeDecode(raw);
  const post = loadPost(slug);
  if (!post) return { title: '글을 찾을 수 없습니다', robots: { index: false } };
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `https://yojalal.com/blog/${encodeURIComponent(post.slug)}` },
    openGraph: {
      type: 'article',
      title: `${post.title} — 요잘알 매거진`,
      description: post.description,
      images: post.image ? [post.image] : ['/img/app-icon.png'],
      publishedTime: post.date,
      tags: post.tags,
    },
    twitter: {
      title: `${post.title} — 요잘알 매거진`,
      description: post.description,
      images: post.image ? [post.image] : ['/img/app-icon.png'],
    },
  };
}

function articleJsonLd(post: ReturnType<typeof loadPost>) {
  if (!post) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: post.image ? [post.image] : ['https://yojalal.com/img/app-icon.png'],
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: '요잘알' },
    publisher: {
      '@type': 'Organization',
      name: '요잘알',
      logo: { '@type': 'ImageObject', url: 'https://yojalal.com/img/app-icon.png' },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://yojalal.com/blog/${encodeURIComponent(post.slug)}`,
    },
    keywords: post.tags.join(', '),
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = safeDecode(raw);
  const post = loadPost(slug);
  if (!post) notFound();

  return (
    <>
      <Topbar />
      {post.image && <img className="hero-img" src={post.image} alt={post.title} />}
      <main className="detail blog-detail">
        <div className="blog-post-meta">
          <span>{post.date}</span>
          {post.tags.length > 0 && (
            <span className="blog-post-tags">
              {post.tags.map((t) => <span key={t} className="blog-post-tag">#{t}</span>)}
            </span>
          )}
        </div>
        <h1 className="title">{post.title}</h1>
        <p className="desc">{post.description}</p>

        <article
          className="blog-post-body"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(post)) }}
      />
    </>
  );
}
