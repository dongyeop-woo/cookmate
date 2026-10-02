/**
 * 요잘알 운영 지표 한 눈에 보기.
 *
 * 콘솔 대시보드가 없으면 "잘 되고 있나?" 를 감으로 판단하게 된다.
 * 2026-09 기준 실제 상황은 가입 2명/월인데 매일 콘텐츠를 만들고 있었다.
 * 숫자를 싸게 볼 수 있어야 멈출지 계속할지 판단할 수 있다.
 *
 * 사용:
 *   node scripts/stats.js            # 요약
 *   node scripts/stats.js --days 14  # 최근 N일 상세 (기본 14)
 *   node scripts/stats.js --full     # 컬렉션 전체 건수까지
 *
 * 읽기 전용이다. 아무것도 쓰지 않는다.
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const args = process.argv.slice(2);
const DAYS = Number(args[args.indexOf('--days') + 1]) || 14;
const FULL = args.includes('--full');

/** Firestore Timestamp / ISO 문자열 / Date 를 모두 Date 로 받는다. */
const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v || 0));
const ymd = (v) => toDate(v).toISOString().slice(0, 10);
const ym = (v) => ymd(v).slice(0, 7);
const daysAgo = (n) => Date.now() - n * 86400000;
const bar = (n, max, w = 28) => '█'.repeat(Math.max(0, Math.round((n / (max || 1)) * w)));

function trend(title, counts) {
  const keys = Object.keys(counts).sort();
  const max = Math.max(...Object.values(counts), 1);
  console.log(`\n${title}`);
  keys.forEach((k) => {
    const n = counts[k];
    console.log(`  ${k}  ${String(n).padStart(4)}  ${bar(n, max)}`);
  });
}

/** 유저 식별자가 문서마다 필드명이 달라서 흔한 후보를 순서대로 본다. */
const uidOf = (x, docId) => x.userId || x.uid || x.user || String(docId).split('_')[0];

async function main() {
  const [users, attendance, reviews, blogViews, recipeViews, recipes, webStats, referrers] =
    await Promise.all([
      db.collection('users').get(),
      db.collection('attendance').get(),
      db.collection('reviews').get(),
      db.collection('web_blog_views').get(),
      db.collection('web_recipe_views').get(),
      db.collection('recipes').count().get(),
      db.collection('web_stats').get(),
      db.collection('web_referrers').get(),
    ]);

  // ── 가입 ──
  const signup = {};
  users.forEach((d) => {
    const v = d.data().createdAt;
    if (v) signup[ym(v)] = (signup[ym(v)] || 0) + 1;
  });

  // ── 활성 (출석 남긴 사람) ──
  const activeByMonth = {};
  const active30 = new Set();
  const active7 = new Set();
  const activeByDay = {};
  attendance.forEach((d) => {
    const x = d.data();
    const when = x.date || x.createdAt;
    const t = toDate(when).getTime();
    const uid = uidOf(x, d.id);
    (activeByMonth[ym(when)] = activeByMonth[ym(when)] || new Set()).add(uid);
    if (t > daysAgo(30)) active30.add(uid);
    if (t > daysAgo(7)) active7.add(uid);
    if (t > daysAgo(DAYS)) (activeByDay[ymd(when)] = activeByDay[ymd(when)] || new Set()).add(uid);
  });

  const reviewByMonth = {};
  reviews.forEach((d) => {
    const v = d.data().createdAt;
    if (v) reviewByMonth[ym(v)] = (reviewByMonth[ym(v)] || 0) + 1;
  });

  const sum = (snap) => {
    let n = 0;
    snap.forEach((d) => { n += Number(d.data().count ?? d.data().views ?? 0); });
    return n;
  };

  const months = Object.keys(signup).sort();
  const thisMonth = months[months.length - 1];

  console.log('═'.repeat(52));
  console.log(' 요잘알 운영 지표  ', new Date().toISOString().slice(0, 10));
  console.log('═'.repeat(52));
  console.log(`  누적 가입          ${users.size}명`);
  console.log(`  이번 달 가입       ${signup[thisMonth] || 0}명  (${thisMonth})`);
  console.log(`  최근 7일 활성      ${active7.size}명`);
  console.log(`  최근 30일 활성     ${active30.size}명`);
  console.log(`  누적 후기          ${reviews.size}건`);
  console.log(`  레시피             ${recipes.data().count}개`);
  console.log(`  레시피/활성유저    ${(recipes.data().count / (active30.size || 1)).toFixed(1)}개  ← 1 이하가 정상`);
  console.log('');
  console.log(`  웹 레시피 조회     ${sum(recipeViews)}회 (${recipeViews.size}개 문서)`);
  console.log(`  웹 매거진 조회     ${sum(blogViews)}회 (${blogViews.size}개 문서)`);

  trend('월별 가입', signup);
  trend('월별 활성 유저', Object.fromEntries(
    Object.entries(activeByMonth).map(([k, v]) => [k, v.size])));
  trend('월별 후기', reviewByMonth);

  const dayKeys = Object.keys(activeByDay).sort().reverse();
  if (dayKeys.length) {
    console.log(`\n최근 ${DAYS}일 일별 활성 유저`);
    const max = Math.max(...dayKeys.map((k) => activeByDay[k].size), 1);
    dayKeys.forEach((k) => console.log(`  ${k}  ${String(activeByDay[k].size).padStart(3)}  ${bar(activeByDay[k].size, max)}`));
  }

  // ── 웹 방문 ──
  // 2026-10-01 이전 수치는 봇이 섞여 있다. 그날 메타 AI 크롤러가 65회 훑고
  // 가면서 방문이 3.3배로 뛴 것처럼 보였다(실제 사람 18명). 그 뒤로 UA 로
  // 걸러 bots 를 따로 센다 — 이전 날짜의 count 는 과장된 값이니 믿지 말 것.
  const daily = [];
  webStats.forEach((d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.id)) return;
    const x = d.data();
    daily.push([d.id, Number(x.count || 0), Number(x.bots || 0)]);
  });
  daily.sort((a, b) => a[0].localeCompare(b[0]));
  const recent = daily.slice(-DAYS);
  if (recent.length) {
    const max = Math.max(...recent.map((r) => r[1]), 1);
    console.log(`\n웹 방문 최근 ${recent.length}일 (사람 / 봇)`);
    recent.forEach(([k, c, b]) =>
      console.log(`  ${k}  ${String(c).padStart(4)} ${b ? `/ 봇 ${String(b).padStart(3)}` : '        '}  ${bar(c, max)}`));
  }

  const refRows = [];
  referrers.forEach((d) => refRows.push([d.id, d.data()]));
  refRows.sort((a, b) => b[0].localeCompare(a[0]));
  if (refRows.length) {
    console.log('\n유입 경로 (최근 7일)');
    refRows.slice(0, 7).forEach(([day, m]) => {
      const parts = Object.entries(m)
        .filter(([, v]) => Number(v) > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`);
      console.log(`  ${day}  ${parts.join(' · ') || '-'}`);
    });
  } else {
    console.log('\n유입 경로: 아직 기록 없음 (백엔드 배포 후부터 쌓임)');
  }

  // 매거진은 어떤 글이 실제로 읽히는지가 중요하다. 상위만 본다.
  const topBlog = [];
  blogViews.forEach((d) => topBlog.push([d.id, Number(d.data().count || 0)]));
  topBlog.sort((a, b) => b[1] - a[1]);
  if (topBlog.length) {
    console.log('\n매거진 조회 상위 5');
    topBlog.slice(0, 5).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  }

  if (FULL) {
    console.log('\n전체 컬렉션 건수');
    const cols = await db.listCollections();
    for (const c of cols) {
      const s = await c.count().get().catch(() => null);
      console.log(`  ${(c.id + ':').padEnd(24)} ${s ? s.data().count : '?'}`);
    }
  }

  console.log('');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
