#!/usr/bin/env node
/**
 * 자동 블로그 글 생성 — Claude API 호출 후 web/content/blog/ 에 .md 저장.
 *
 * 사용:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/gen-blog-post.mjs
 *
 * GitHub Actions 에서 매일 1회 자동 실행.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, '..', 'content', 'blog');
const INDEX_FILE = path.join(__dirname, '..', 'lib', 'blog-index.ts');

/** 계절별 트렌드 키워드 + 매칭할 카테고리(요잘알 10종 중). 매일 랜덤 1개 선택. */
const SEASON_KEYWORDS = {
  spring: [
    { kw: '봄나물 활용', cats: ['아침', '점심', '한식'] },
    { kw: '봄 도시락', cats: ['점심', '아침'] },
    { kw: '봄철 다이어트', cats: ['아침', '점심', '간식'] },
    { kw: '신학기 아침', cats: ['아침'] },
    { kw: '봄 소풍 음식', cats: ['점심', '간식', '분식'] },
    { kw: '딸기 활용', cats: ['디저트', '음료'] },
  ],
  summer: [
    { kw: '에어프라이어 여름 메뉴', cats: ['점심', '저녁', '야식'] },
    { kw: '시원한 면 요리', cats: ['점심', '분식', '한식'] },
    { kw: '여름 보양식', cats: ['점심', '저녁', '한식'] },
    { kw: '간단 비건', cats: ['아침', '점심', '한식'] },
    { kw: '냉장고 정리 레시피', cats: ['점심', '저녁'] },
    { kw: '캠핑 한 그릇', cats: ['저녁', '야식'] },
    { kw: '여름 디저트', cats: ['디저트', '음료'] },
  ],
  fall: [
    { kw: '환절기 보양 국', cats: ['저녁', '한식'] },
    { kw: '제철 가을 채소', cats: ['점심', '저녁', '한식'] },
    { kw: '단호박 활용', cats: ['아침', '디저트', '간식'] },
    { kw: '면역력 식단', cats: ['아침', '점심', '저녁'] },
    { kw: '도시락 가을 메뉴', cats: ['점심', '아침'] },
    { kw: '버섯 요리', cats: ['점심', '저녁', '한식'] },
  ],
  winter: [
    { kw: '따뜻한 한 그릇', cats: ['저녁', '한식', '야식'] },
    { kw: '집밥 김장', cats: ['한식'] },
    { kw: '겨울 보양식', cats: ['저녁', '한식'] },
    { kw: '연말 모임 안주', cats: ['야식', '양식'] },
    { kw: '새해 첫끼', cats: ['아침', '한식'] },
    { kw: '뜨끈한 국', cats: ['저녁', '한식'] },
  ],
};

const RECIPE_API = 'https://devl-backend-879574205436.asia-northeast3.run.app/api/recipes';
const SITE_BASE = 'https://yojalal.com';

function getCurrentSeason(date) {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'fall';
  return 'winter';
}

async function getRecentSlugs() {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    return files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

async function fetchRecipesByCategories(cats) {
  try {
    const res = await fetch(RECIPE_API);
    if (!res.ok) return [];
    const all = await res.json();
    const filtered = all.filter((r) => r.category && cats.includes(r.category) && r.image);
    // 셔플 + 상위 8개
    return filtered.sort(() => Math.random() - 0.5).slice(0, 8);
  } catch (e) {
    console.warn('[gen-blog] 레시피 fetch 실패:', e.message);
    return [];
  }
}

function recipeContextBlock(recipes) {
  if (recipes.length === 0) return '(레시피 컨텍스트 없음 — 일반 가이드로 작성)';
  return recipes
    .map((r, i) => {
      const time = Math.round(r.time ?? 0);
      const kcal = r.calories ?? 0;
      const diff = r.difficulty ?? '';
      const desc = (r.description ?? '').replace(/\s+/g, ' ').slice(0, 80);
      return `${i + 1}. **${r.title}** (id=${r.id}, 카테고리=${r.category})
   - 이미지: ${r.image}
   - 메타: ${time}분 · ${diff} · ${kcal}kcal
   - 설명: ${desc}
   - 링크: ${SITE_BASE}/recipe/${r.id}`;
    })
    .join('\n');
}

function buildPrompt(date, keyword, recentSlugs, recipes) {
  const dateStr = date.toISOString().slice(0, 10);
  const recipesBlock = recipeContextBlock(recipes);
  const firstImage = recipes[0]?.image ?? 'https://yojalal.com/img/app-icon.png';

  return `당신은 한국 인기 요리 매거진 "요잘알 매거진"의 시니어 에디터입니다.
오늘(${dateStr}) 발행할 **쇼츠 스타일 큐레이션** 블로그 글을 작성하세요.

# 가장 중요 — 쇼츠/SNS 시대 스타일
- 사용자는 긴 글 안 읽어요. **스크롤하면서 이미지+한 줄 코멘트** 위주로 봅니다.
- 텍스트는 최소화, **레시피 카드(이미지) 다수**가 핵심.
- 한 단락은 **1~2줄**. 절대 4줄 넘기지 마세요.
- 본문 총 글자 수는 **500~900자 사이** (frontmatter 제외).

# 키워드
"${keyword}"

# 활용 가능한 요잘알 레시피 (8개 중 4~6개를 본문에 카드로 박으세요)
${recipesBlock}

# 글 구조 (반드시 이 틀로)
\`\`\`
---
[frontmatter — 아래 형식]
---

## 들어가며

(2~3줄 짧은 도입. 왜 지금 이 주제가 필요한지.)

## 1. [메뉴 이름]

[레시피 카드 HTML]

**핵심 팁**: (1~2줄, 굵게 처리한 짧은 포인트)

## 2. [메뉴 이름]

[레시피 카드 HTML]

**핵심 팁**: (1~2줄)

... (총 4~6개 메뉴 반복)

## 마치며

(2~3줄. 요잘알 앱 자연스러운 안내.)
\`\`\`

# 레시피 카드 마크업 (이거만 정확히 따르면 됨)
<a class="blog-recipe-card" href="LINK">
  <img src="IMAGE_URL" alt="TITLE">
  <div class="blog-recipe-card-body">
    <span class="blog-recipe-card-title">TITLE</span>
    <span class="blog-recipe-card-meta">⏱ TIME분 · DIFFICULTY · KCALkcal</span>
    <p class="blog-recipe-card-desc">DESC</p>
  </div>
</a>

위 8개 레시피의 LINK/IMAGE_URL/TITLE/TIME/DIFFICULTY/KCAL/DESC 값을 그대로 사용.

# frontmatter (반드시 이 형식)
---
title: 글 제목 (15자 내외, 키워드 + 숫자 강조 예: "여름 5분 면 BEST 5")
description: 100자 이내 한 줄 설명
date: ${dateStr}
slug: short-english-slug-with-hyphens
tags:
  - 태그1
  - 태그2
  - 태그3
  - 태그4
image: ${firstImage}
---

# 절대 하지 말 것
- 한 단락 4줄 이상 X
- 들어가며 섹션 3줄 이상 X
- "왜 이게 좋은가" 같은 설명 길게 X
- 영양·역사·문화 설명 X (사용자 안 읽어요)
- 총 글자 900자 초과 X
- 코드블록·다른 설명 X. 바로 frontmatter 부터 시작.

# 기존 글 중복 방지
최근 글 slug: ${recentSlugs.slice(0, 10).join(', ') || '(없음)'}

지금 바로 작성 시작:`;
}

async function callClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수 미설정');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.content[0].text.trim();
}

function extractFrontmatter(markdown) {
  const m = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const getField = (name) => {
    const re = new RegExp(`^${name}:\\s*(.+)$`, 'm');
    const mm = fm.match(re);
    return mm ? mm[1].trim().replace(/^["']|["']$/g, '') : null;
  };
  return { title: getField('title'), slug: getField('slug'), date: getField('date'), image: getField('image') };
}

/** AI 가 카드 안 image URL 을 잘못 적는 환각 방지 — recipe id 로 정확한 URL 재주입. */
function fixRecipeCardImages(markdown, recipes) {
  const byId = new Map(recipes.map((r) => [String(r.id), r.image]));
  return markdown.replace(
    /(<a class="blog-recipe-card" href="https:\/\/yojalal\.com\/recipe\/(\d+)">\s*\n\s*<img src=")[^"]+(")/g,
    (_full, head, id, tail) => {
      const correctImage = byId.get(id);
      if (!correctImage) return `${head}${_full.match(/<img src="([^"]+)"/)?.[1] ?? ''}${tail}`;
      return `${head}${correctImage}${tail}`;
    },
  );
}

/** frontmatter 에 image 누락 시 첫 추천 레시피 이미지로 보강. */
function ensureImageInFrontmatter(markdown, fallbackImage) {
  if (!fallbackImage) return markdown;
  const m = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return markdown;
  const fm = m[1];
  if (/^image:\s*\S+/m.test(fm)) return markdown; // 이미 있음
  const newFm = `${fm}\nimage: ${fallbackImage}`;
  return markdown.replace(/^---\s*\n[\s\S]*?\n---/, `---\n${newFm}\n---`);
}

async function updateBlogIndex(slug, dateStr) {
  const content = await fs.readFile(INDEX_FILE, 'utf8');
  // 중복 방지
  if (content.includes(`slug: '${slug}'`)) {
    console.log('[gen-blog] index 이미 등록됨, skip');
    return;
  }
  const newEntry = `  { slug: '${slug}', date: '${dateStr}' },`;
  const updated = content.replace(
    /(export const BLOG_INDEX: BlogIndexEntry\[\] = \[)/,
    `$1\n${newEntry}`,
  );
  if (updated === content) {
    throw new Error('blog-index.ts 갱신 실패 (마커 못 찾음)');
  }
  await fs.writeFile(INDEX_FILE, updated, 'utf8');
  console.log(`[gen-blog] blog-index.ts 갱신: ${slug}`);
}

async function main() {
  const today = new Date();
  const season = getCurrentSeason(today);
  const keywords = SEASON_KEYWORDS[season];
  const picked = keywords[Math.floor(Math.random() * keywords.length)];
  const keyword = picked.kw;
  const cats = picked.cats;
  const recentSlugs = await getRecentSlugs();
  const recipes = await fetchRecipesByCategories(cats);

  console.log(`[gen-blog] 시작 — 날짜=${today.toISOString().slice(0, 10)} 계절=${season} 키워드="${keyword}" 매칭레시피=${recipes.length}개`);

  const prompt = buildPrompt(today, keyword, recentSlugs, recipes);
  const rawMarkdown = await callClaude(prompt);

  const meta = extractFrontmatter(rawMarkdown);
  if (!meta?.slug || !meta.title) {
    console.error('[gen-blog] frontmatter 파싱 실패. 응답 앞부분:\n', rawMarkdown.slice(0, 500));
    throw new Error('frontmatter 추출 실패');
  }

  // image 누락 시 첫 추천 레시피 이미지로 보강 (목록 카드에 필수)
  let markdown = meta.image ? rawMarkdown : ensureImageInFrontmatter(rawMarkdown, recipes[0]?.image);
  // 카드 안 image URL 환각 교정
  markdown = fixRecipeCardImages(markdown, recipes);

  const dateStr = today.toISOString().slice(0, 10);
  // 파일명: date prefix + slug (sort + 중복 방지)
  const filename = `${dateStr}-${meta.slug}.md`;
  const fullSlug = filename.replace(/\.md$/, '');

  await fs.mkdir(CONTENT_DIR, { recursive: true });
  await fs.writeFile(path.join(CONTENT_DIR, filename), markdown, 'utf8');
  await updateBlogIndex(fullSlug, dateStr);

  console.log(`[gen-blog] ✅ 완료: ${filename}`);
  console.log(`[gen-blog] 제목: ${meta.title}`);
}

main().catch((e) => {
  console.error('[gen-blog] ❌ 실패:', e.message);
  process.exit(1);
});
