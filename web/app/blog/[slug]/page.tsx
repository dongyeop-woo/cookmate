import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Topbar from '../../Topbar';
import Footer from '../../Footer';
import BlogViewTracker from '../../BlogViewTracker';
import BlogViewCount from '../../BlogViewCount';
import AdFitBanner from '../../AdFitBanner';
import AppDownloadModal from '../../AppDownloadModal';
import { getAllSlugs, loadPost } from '@/lib/blog';

export const dynamic = 'force-static';

type Props = { params: Promise<{ slug: string }> };

/**
 * 본문을 광고 넣을 자리에서 둘로 가른다.
 *
 * 매거진 글은 `## 들어가며` → `## 1. 메뉴` → `## 2. 메뉴` … 구조라,
 * 3번째 h2(= 레시피 카드 두 개를 지난 자리) 앞이 자연스럽다. 글 맨 아래에만
 * 두면 500~900자짜리 글에서는 끝까지 내려간 사람만 보게 된다.
 *
 * 애드핏은 한 페이지에 같은 광고 단위를 두 번 넣을 수 없어 하나만 끼운다.
 */
function splitForAd(html: string): [string, string] {
  const at = [...html.matchAll(/<h2[\s>]/g)].map((m) => m.index ?? -1).filter((i) => i >= 0);
  const cut = at[3] ?? at[Math.floor(at.length / 2)];
  if (cut === undefined || cut <= 0) return [html, ''];
  return [html.slice(0, cut), html.slice(cut)];
}

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
  const [bodyHead, bodyTail] = splitForAd(post.bodyHtml);

  return (
    <>
      <BlogViewTracker slug={slug} />
      <Topbar />
      {post.image && <img className="hero-img" src={post.image} alt={post.title} />}
      <main className="detail blog-detail">
        <div className="blog-post-meta">
          <span>{post.date}</span>
          <BlogViewCount slug={slug} />
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
          dangerouslySetInnerHTML={{ __html: bodyHead }}
        />
        {bodyTail && (
          <>
            <AdFitBanner />
            <article
              className="blog-post-body"
              dangerouslySetInnerHTML={{ __html: bodyTail }}
            />
          </>
        )}

        {/* 검색으로 들어온 사람이 글을 다 읽고 나가는 걸 막는 유일한 동선.
            글 본문은 "나머지는 요잘알 앱에서 확인 가능합니다" 로 끝나는데
            정작 누를 게 없었다. 매거진 페이지엔 사이드바가 없어서 앱 유도가
            상단바 링크 하나뿐이었다. */}
        <aside className="blog-app-cta">
          <img src="/img/appIcon-padded.png" alt="" aria-hidden />
          <div className="blog-app-cta-text">
            <strong>요잘알 앱에서 더 보기</strong>
            <span>레시피 전체를 단계별 사진과 함께</span>
          </div>
          <AppDownloadModal className="blog-app-cta-btn">앱 다운로드</AppDownloadModal>
        </aside>
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(post)) }}
      />
    </>
  );
}
