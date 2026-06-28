/**
 * 블로그 글 인덱스 — sitemap·검색 등에 사용.
 * 자동 생성 스크립트(scripts/gen-blog-post.mjs)가 글 추가 시 이 파일을 업데이트합니다.
 * 수동으로 글 추가/삭제 시에도 동기화해주세요.
 */
export type BlogIndexEntry = {
  slug: string;
  date: string; // YYYY-MM-DD
};

export const BLOG_INDEX: BlogIndexEntry[] = [
  { slug: '2026-06-28-summer-cold-noodles-best-4', date: '2026-06-28' },
  { slug: '2026-06-27-air-fryer-summer-menu-best-5', date: '2026-06-27' },
];
