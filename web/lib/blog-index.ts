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
  { slug: '2026-09-24-leftover-holiday-food-best-6', date: '2026-09-24' },
  { slug: '2026-09-23-transitional-season-nourishing-soup-best-5', date: '2026-09-23' },
  { slug: '2026-09-22-immune-boost-diet-best-5', date: '2026-09-22' },
  { slug: '2026-09-21-autumn-easy-pick-best-5', date: '2026-09-21' },
  { slug: '2026-09-20-mushroom-hearty-meal-best-5', date: '2026-09-20' },
  { slug: '2026-09-19-autumn-quick-snack-best-5', date: '2026-09-19' },
  { slug: '2026-09-04-early-autumn-soup-best-5', date: '2026-09-04' },
  { slug: '2026-07-04-weekend-night-drinking-snacks-best-5', date: '2026-07-04' },
  { slug: '2026-07-03-weekend-brunch-best-5', date: '2026-07-03' },
  { slug: '2026-07-02-summer-diet-dinner-under-400kcal', date: '2026-07-02' },
  { slug: '2026-07-01-rainy-season-jeon-best-5', date: '2026-07-01' },
  { slug: '2026-06-30-summer-boyangsik-best-5', date: '2026-06-30' },
  { slug: '2026-06-29-summer-home-cafe-best-4', date: '2026-06-29' },
  { slug: '2026-06-28-summer-cold-noodles-best-4', date: '2026-06-28' },
  { slug: '2026-06-27-air-fryer-summer-menu-best-5', date: '2026-06-27' },
];
