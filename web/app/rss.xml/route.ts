import { getAllPosts } from '@/lib/blog';

/**
 * 매거진 RSS 피드.
 *
 * 네이버 서치어드바이저는 사이트맵보다 RSS 로 수집하는 비중이 크다. 매일 글이
 * 올라오는 매거진이라 RSS 를 제출해 두면 새 글이 훨씬 빨리 잡힌다.
 *
 * sitemap.ts 는 edge 런타임이라 fs 를 못 써서 BLOG_INDEX(슬러그·날짜만) 로
 * 만든다. RSS 는 제목·요약이 있어야 의미가 있으므로 빌드 타임에 정적으로
 * 굽고 fs 로 본문을 읽는다 (블로그 페이지와 같은 방식).
 */
export const dynamic = 'force-static';

const BASE = 'https://yojalal.com';

/** XML 에 그대로 넣으면 깨지는 문자들. CDATA 안이라도 ]]> 는 막아야 한다. */
function cdata(s: string): string {
  return `<![CDATA[${String(s ?? '').replace(/]]>/g, ']]&gt;')}]]>`;
}

export async function GET() {
  const posts = getAllPosts().slice(0, 50);
  const updated = posts[0]?.date ? new Date(posts[0].date) : new Date();

  const items = posts
    .map((p) => {
      const url = `${BASE}/blog/${encodeURIComponent(p.slug)}`;
      // 날짜만 있는 글이라 09:00 KST(발행 시각)로 맞춘다 — 00:00 UTC.
      const pub = new Date(`${p.date}T00:00:00Z`).toUTCString();
      return `    <item>
      <title>${cdata(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pub}</pubDate>
      <description>${cdata(p.description)}</description>
${p.tags.map((t) => `      <category>${cdata(t)}</category>`).join('\n')}
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>요잘알 매거진</title>
    <link>${BASE}/blog</link>
    <description>오늘 뭐 먹지? 매일 올라오는 집밥·자취 요리 레시피 큐레이션</description>
    <language>ko</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}
