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

/** 계절별 트렌드 키워드. 매일 랜덤 1개 선택. */
const SEASON_KEYWORDS = {
  spring: ['봄나물 활용', '봄 도시락', '봄철 다이어트', '신학기 아침', '봄 소풍 음식', '딸기 활용'],
  summer: ['에어프라이어 여름 메뉴', '시원한 면 요리', '여름 보양식', '간단 비건', '냉장고 정리 레시피', '캠핑 한 그릇', '여름 디저트'],
  fall: ['환절기 보양 국', '제철 가을 채소', '단호박 활용', '면역력 식단', '도시락 가을 메뉴', '버섯 요리'],
  winter: ['따뜻한 한 그릇', '집밥 김장', '겨울 보양식', '연말 모임 안주', '새해 첫끼', '뜨끈한 국'],
};

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

function buildPrompt(date, keyword, recentSlugs) {
  const dateStr = date.toISOString().slice(0, 10);
  return `당신은 한국의 인기 요리 매거진 "요잘알 매거진(yojalal.com/blog)"의 시니어 에디터입니다.
오늘(${dateStr}) 발행할 블로그 글 한 편을 작성하세요.

핵심 주제 키워드: "${keyword}"

# 작성 요구사항
1. **톤**: 가이드/정보 제공형. "...해보세요", "...할 수 있습니다", "...팁입니다" 톤. 친근하지만 신뢰감 있게.
2. **분량**: 1800~2500자.
3. **글 구조**:
   - frontmatter (YAML) — 가장 먼저
   - "## 들어가며" 또는 도입 문단 (왜 이 주제가 지금 시기에 의미 있는지)
   - "## " 헤더 3~5개로 본문 분할
   - 각 섹션은 3~6 단락
   - 인용구 (>)·리스트 적절히 활용
   - "## 마치며" — 결론 + 요잘알 앱/사이트 자연스러운 안내 ("요잘알 앱에서는..." 또는 "yojalal.com 에서...")
4. **SEO**:
   - 제목에 핵심 키워드 자연스럽게 포함
   - description (150자 이내) 에도 키워드 분포
   - tags 4~6개 (한글)
5. **고유성**: 기존 글과 중복 X. 최근 글 slug:
   ${recentSlugs.slice(0, 10).join(', ') || '(없음)'}

# frontmatter 형식 (반드시 따르기)
\`\`\`
---
title: 글 제목 (한글)
description: 150자 이내 한 줄 설명
date: ${dateStr}
slug: short-english-slug-with-hyphens
tags:
  - 태그1
  - 태그2
  - 태그3
  - 태그4
image: https://yojalal.com/img/app-icon.png
---
\`\`\`

- slug 는 반드시 영문+숫자+하이픈만. 30자 이내. 예: summer-airfryer-meals, fall-immunity-soup
- 다른 설명·메타 코멘트·\`\`\`markdown 코드블록 X. 바로 frontmatter 부터 시작하세요.

지금 작성 시작:`;
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
  return { title: getField('title'), slug: getField('slug'), date: getField('date') };
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
  const keyword = keywords[Math.floor(Math.random() * keywords.length)];
  const recentSlugs = await getRecentSlugs();

  console.log(`[gen-blog] 시작 — 날짜=${today.toISOString().slice(0, 10)} 계절=${season} 키워드="${keyword}"`);

  const prompt = buildPrompt(today, keyword, recentSlugs);
  const markdown = await callClaude(prompt);

  const meta = extractFrontmatter(markdown);
  if (!meta?.slug || !meta.title) {
    console.error('[gen-blog] frontmatter 파싱 실패. 응답 앞부분:\n', markdown.slice(0, 500));
    throw new Error('frontmatter 추출 실패');
  }

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
