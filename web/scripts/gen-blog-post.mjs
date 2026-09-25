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
    { kw: '명절 남은 음식 활용', cats: ['점심', '저녁', '한식'] },
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

/** 최근 글 {slug, title} — 중복 방지 + 내부 링크 앵커 텍스트용. 최신순. */
async function getRecentPosts(limit = 6) {
  try {
    const files = (await fs.readdir(CONTENT_DIR))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, limit);
    return Promise.all(
      files.map(async (f) => {
        const slug = f.replace(/\.md$/, '');
        let title = slug;
        try {
          const raw = await fs.readFile(path.join(CONTENT_DIR, f), 'utf-8');
          title = raw.match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, '') ?? slug;
        } catch {}
        return { slug, title };
      }),
    );
  } catch {
    return [];
  }
}

async function fetchRecipesByCategories(cats, preferNewest = false) {
  try {
    const res = await fetch(RECIPE_API);
    if (!res.ok) return [];
    const all = await res.json();
    const filtered = all.filter((r) => r.category && cats.includes(r.category) && r.image);
    if (preferNewest) {
      // 명절 주간에는 그 시기에 맞춰 새로 올린 레시피를 먼저 쓴다.
      // 랜덤으로 뽑으면 기존 레시피에 묻혀 정작 명절 메뉴가 빠진다.
      //
      // 최신순으로 넘기는 것만으로는 부족했다. 2026-09-24 추석 글에서 후보
      // 8개 중 상위 4개가 전부 그날 올린 명절 레시피였는데도, 모델이 키워드에
      // 더 잘 맞는 옛 레시피를 골라 신규는 2개만 실렸다. 프롬프트가 신규를
      // 구분할 수 있도록 여기서 isNew 를 달아 준다.
      const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
      return [...filtered]
        .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
        .slice(0, 8)
        .map((r) => ({ ...r, isNew: Date.parse(r.createdAt ?? '') > weekAgo }));
    }
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
      return `${i + 1}. **${r.title}**${r.isNew ? ' 〔신규〕' : ''} (id=${r.id}, 카테고리=${r.category})
   - 이미지: ${r.image}
   - 메타: ${time}분 · ${diff} · ${kcal}kcal
   - 설명: ${desc}
   - 링크: ${SITE_BASE}/recipe/${r.id}`;
    })
    .join('\n');
}

function buildPrompt(date, keyword, recentPosts, recipes) {
  const dateStr = date.toISOString().slice(0, 10);
  const recipesBlock = recipeContextBlock(recipes);
  const newOnes = recipes.filter((r) => r.isNew);
  // 〔신규〕가 있으면 그게 오늘 글의 존재 이유다. 모델이 알아서 고르게 두면
  // 키워드에 잘 맞는 옛 레시피에 밀리므로 전부 넣으라고 못 박는다.
  const newRule = newOnes.length
    ? `\n**〔신규〕가 붙은 ${newOnes.length}개는 이 시기에 맞춰 오늘 새로 올린 레시피입니다. 하나도 빼지 말고 전부 카드로 넣고, 본문 앞쪽(1번부터) 순서로 배치하세요.** 이 규칙은 아래 "메뉴 배열 순서"보다 우선합니다. 나머지 레시피는 6개를 채우는 용도로만 쓰세요.\n`
    : '';
  const firstImage = recipes[0]?.image ?? 'https://yojalal.com/img/app-icon.png';
  const linkTarget = recentPosts[0];

  return `당신은 한국 인기 요리 매거진 "요잘알 매거진"의 시니어 에디터입니다.
오늘(${dateStr}) 발행할 **쇼츠 스타일 큐레이션** 블로그 글을 작성하세요.

# 가장 중요 — 쇼츠/SNS 시대 스타일
- 사용자는 긴 글 안 읽어요. **스크롤하면서 이미지+짧은 텍스트** 위주로 봅니다.
- 텍스트는 최소화, **레시피 카드(이미지) 다수**가 핵심.
- 한 단락은 **1~2줄**. 절대 4줄 넘기지 마세요.
- 본문 총 글자 수는 **500~900자 사이** (frontmatter 제외). 짧을수록 좋습니다.

# 키워드
"${keyword}"

# 활용 가능한 요잘알 레시피 (8개 중 4~6개를 본문에 카드로 박으세요)
${recipesBlock}
${newRule}

# 메뉴 배열 순서
조리 시간이 **짧은 것부터 긴 것 순서**로 배열하세요.
독자가 "평일 아침엔 앞쪽, 주말엔 뒤쪽"으로 바로 고를 수 있게 됩니다.

# 본문 설명과 카드 설명의 역할 분리 (중요)
같은 말을 두 번 쓰지 마세요. 역할이 다릅니다.
- **본문 단락** = "왜 지금 이걸" — 제철·날씨·상황·조리 시간 맥락
- **카드 desc** = "이게 뭔지" — 레시피 원본 설명 그대로

나쁜 예 (본문이 카드 설명을 반복):
  본문: "겉바속촉 황금빛 후라이드 치킨. 치킨의 클래식!"
  카드: "겉바속촉 황금빛 후라이드 치킨. 치킨의 클래식!"

좋은 예 (본문이 맥락을 더함):
  본문: "무가 제철로 들어가는 때라 지금이 가장 답니다. 감기 기운 있을 때 속이 편해요."
  카드: "담백하고 시원한 소고기 뭇국. 숙취에도, 감기에도 최고의 국물!"

# 계절 맥락은 오늘(${dateStr}) 기준으로
레시피 원본 설명에 적힌 계절 표현을 **그대로 옮기지 마세요**.
예: 7월 글에 "봄 인기 안주"라고 쓰면 안 됩니다. 오늘 날짜에 맞게 다시 쓰세요.

# 핵심 팁은 조리 원리로
레시피 설명을 요약하지 말고, **실제로 결과가 달라지는 한 가지 동작**을 쓰세요.
좋은 예: "처음 끓어오른 물은 버리고 새 물로 다시 시작하세요. 잡내가 확실히 잡힙니다."
나쁜 예: "정성껏 끓이면 맛있어요."

# 글 구조 (반드시 이 틀로)
\`\`\`
---
[frontmatter — 아래 형식]
---

## 들어가며

(2~3줄 짧은 도입. 왜 지금 이 주제가 필요한지.)

## 1. [메뉴 이름]

(메뉴 자체 간단 설명 1~2줄: 어떤 음식인지·왜 이 시기/상황에 좋은지·맛/포만감/영양 한두 줄. 너무 깊이 X.)

[레시피 카드 HTML]

**핵심 팁**: (1~2줄, 굵게 처리한 짧은 포인트)

## 2. [메뉴 이름]

(메뉴 설명 1~2줄)

[레시피 카드 HTML]

**핵심 팁**: (1~2줄)

... (총 4~6개 메뉴 반복)

## 마치며

(2~3줄. 상황별로 몇 번을 고르면 되는지 한 줄 + 요잘알 앱 안내.)

(마지막 줄: 아래 "내부 링크" 지시대로 이전 글 링크 1개)
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

# 내부 링크 (마지막 줄에 1개)
글 맨 끝에 이전 매거진 글로 가는 링크를 한 줄 넣으세요. 검색 유입과 체류시간에 도움이 됩니다.
${
  linkTarget
    ? `형식: [${linkTarget.title}](/blog/${linkTarget.slug})
앞에 자연스러운 연결 문장을 한 마디 붙이세요. 예: "지난 주 메뉴가 궁금하시면 ○○도 함께 보세요."`
    : '(이전 글이 없으니 이번엔 생략)'
}

# 절대 하지 말 것
- 한 단락 4줄 이상 X
- 들어가며 섹션 3줄 이상 X
- "왜 이게 좋은가" 같은 설명 길게 X
- 영양·역사·문화 설명 X (사용자 안 읽어요)
- 총 글자 900자 초과 X
- 이모지 X (제목·본문·마치며 전부)
- 코드블록·다른 설명 X. 바로 frontmatter 부터 시작.

# 기존 글 중복 방지 (최근 글 — 소재가 겹치면 다른 각도로)
${recentPosts.map((p) => `- ${p.title} (${p.slug})`).join('\n') || '(없음)'}

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
      model: 'claude-sonnet-5',
      max_tokens: 8192,
      // Sonnet 5 는 thinking 이 기본 ON 이라 content[0] 이 thinking 블록이 된다.
      // 이 작업은 정해진 틀을 채우는 일이라 추론이 필요 없고, 켜두면 max_tokens 를
      // thinking 과 나눠 쓰느라 글이 잘릴 수 있어 끈다.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText}`);
  }
  const data = await res.json();

  // content 에는 text 외 블록(thinking 등)이 섞일 수 있다. 인덱스로 찍지 말 것.
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    const kinds = (data.content ?? []).map((b) => b.type).join(', ') || '(없음)';
    throw new Error(`Claude 응답에 text 블록이 없음 — stop_reason=${data.stop_reason}, 블록=[${kinds}]`);
  }
  if (data.stop_reason === 'max_tokens') {
    console.warn('[gen-blog] max_tokens 도달 — 글이 중간에 잘렸을 수 있습니다.');
  }
  console.log(`[gen-blog] 응답 수신 — 입력 ${data.usage?.input_tokens}토큰 / 출력 ${data.usage?.output_tokens}토큰`);
  return textBlock.text.trim();
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

/**
 * 명절 주간 전용 키워드. 한국 레시피 검색은 이 주에 연중 최대로 몰리는데,
 * 일반 계절 키워드 풀에 섞으면 랜덤이라 놓칠 수 있어 기간 중엔 여기서만 뽑는다.
 * 연휴가 바뀌면 날짜만 고쳐주면 된다.
 */
const HOLIDAY_WINDOWS = [
  {
    name: '추석',
    from: '2026-09-24', to: '2026-09-29',
    keywords: [
      // 상차림 글에는 나물·전 같은 반찬이 같이 올라야 한 상이 된다.
      { kw: '추석 상차림', cats: ['한식', '저녁', '반찬'] },
      { kw: '명절 전 요리', cats: ['한식', '간식'] },
      { kw: '차례상 나물', cats: ['한식', '반찬'] },
      // 연휴 첫날에 "남은 음식"을 쓰면 아직 남은 게 없다. 후반부에만 뽑는다.
      { kw: '명절 남은 음식 활용', cats: ['점심', '저녁', '한식'], from: '2026-09-27' },
      { kw: '손님상 한 그릇', cats: ['점심', '한식'] },
    ],
  },
];

/** 오늘(KST)이 명절 주간이면 그 키워드 풀을, 아니면 계절 풀을 돌려준다. */
function isHolidayWeek(date) {
  const today = new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return HOLIDAY_WINDOWS.some((h) => today >= h.from && today <= h.to);
}

function keywordPool(date, season) {
  // Actions 는 UTC 로 돈다. 09:00 KST 발행이므로 KST 기준 날짜로 비교해야 한다.
  const today = new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  for (const h of HOLIDAY_WINDOWS) {
    if (today >= h.from && today <= h.to) {
      console.log(`[gen-blog] ${h.name} 주간 — 명절 키워드에서 선택`);
      // from/to 가 달린 키워드는 해당 구간에만 후보로 올린다.
      return h.keywords.filter((k) => (!k.from || today >= k.from) && (!k.to || today <= k.to));
    }
  }
  return SEASON_KEYWORDS[season];
}

async function main() {
  const today = new Date();
  const season = getCurrentSeason(today);
  const keywords = keywordPool(today, season);
  const picked = keywords[Math.floor(Math.random() * keywords.length)];
  const keyword = picked.kw;
  const cats = picked.cats;
  const recentPosts = await getRecentPosts();
  const recipes = await fetchRecipesByCategories(cats, isHolidayWeek(today));

  console.log(`[gen-blog] 시작 — 날짜=${today.toISOString().slice(0, 10)} 계절=${season} 키워드="${keyword}" 매칭레시피=${recipes.length}개`);

  const prompt = buildPrompt(today, keyword, recentPosts, recipes);
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
