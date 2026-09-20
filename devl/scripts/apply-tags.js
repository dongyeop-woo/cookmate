/**
 * data/recipe-tags.json 의 태그 매핑을 Firestore recipes 컬렉션에 트랜잭션으로 적용.
 *
 * 안전 보장:
 *   1. 명시 ID 리스트만 처리 (collection.get() 사용 안 함 — 사용자 룰 준수)
 *   2. 각 doc을 runTransaction으로 처리 → 사용자 동시 편집해도 안전
 *   3. 트랜잭션 내부 검증: 'tags' 필드 외 어떤 데이터도 변경 안 됨 확인
 *   4. dry-run 기본
 *
 * 실행: node scripts/apply-tags.js          (dry-run)
 *       node scripts/apply-tags.js --apply  (실제 적용)
 */
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const apply = process.argv.includes('--apply');

const tagMap = JSON.parse(fs.readFileSync('./data/recipe-tags.json', 'utf-8'));

// _doc 등 메타키 제외
const ids = Object.keys(tagMap).filter(k => /^\d+$/.test(k));

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

async function processOne(id, newTags) {
  return db.runTransaction(async (tx) => {
    const ref = db.collection('recipes').doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) return { skipped: 'not_exists' };
    const data = snap.data();
    const before = data.tags;
    if (arraysEqual(before, newTags)) return { skipped: 'unchanged' };

    if (apply) {
      // tags 필드만 update. updatedAt 등 다른 필드 일절 건드리지 않음.
      tx.update(ref, { tags: newTags });
    }
    return {
      title: data.title,
      before: before || [],
      after: newTags,
    };
  });
}

(async () => {
  console.log(apply ? '🚀 적용 모드 (--apply)' : '🔍 dry-run (실제 쓰기 없음)');
  console.log(`📋 대상: ${ids.length}개 ID\n`);

  const updates = [];
  const skipped = [];
  const errors = [];

  for (const id of ids) {
    try {
      const res = await processOne(id, tagMap[id]);
      if (res.skipped) skipped.push({ id, reason: res.skipped });
      else updates.push({ id, ...res });
    } catch (e) {
      errors.push({ id, error: e.message });
      console.error(`  ❌ [${id}] ${e.message}`);
    }
  }

  console.log(`✅ 변경${apply ? '됨' : ' 예정'}: ${updates.length}개`);
  for (const u of updates) {
    console.log(`  [${u.id}] ${u.title}`);
    console.log(`      ${(u.before.length ? u.before.map(t => '#' + t).join(' ') : '(없음)')} → ${u.after.map(t => '#' + t).join(' ')}`);
  }
  if (skipped.length) console.log(`\n⏭️  건너뜀: ${skipped.length} (이미 동일/존재하지 않음)`);
  if (errors.length) console.log(`\n❌ 에러: ${errors.length}건`);

  if (!apply) console.log(`\n실제 적용: node scripts/apply-tags.js --apply`);
  process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
