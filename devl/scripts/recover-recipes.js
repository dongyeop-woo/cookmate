/**
 * Firestore recipes 컬렉션 과거 버전 조회 (PITR 기본 1시간 윈도우).
 * 지정 시점의 스냅샷을 JSON 파일로 저장하고, 현재와 차이를 보고.
 *
 * 사용:
 *   node scripts/recover-recipes.js "2026-04-23T14:00:00Z"
 *     → 지정 시점의 스냅샷을 recipes-recovery-<timestamp>.json 으로 저장
 *     → 현재와 달라진 문서 ID 와 필드 출력
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const readTimeIso = process.argv[2];
if (!readTimeIso) {
  console.error('❌ 사용법: node scripts/recover-recipes.js "2026-04-23T14:00:00Z"');
  process.exit(1);
}

(async () => {
  try {
    const readTime = admin.firestore.Timestamp.fromDate(new Date(readTimeIso));
    console.log(`🕐 조회 시점: ${readTimeIso}\n`);

    // 과거 시점 스냅샷
    const oldSnap = await db.collection('recipes').get({ readTime });
    const oldData = {};
    oldSnap.forEach(d => { oldData[d.id] = d.data(); });
    console.log(`📸 과거 스냅샷: ${oldSnap.size}개 문서`);

    // 현재 스냅샷
    const curSnap = await db.collection('recipes').get();
    const curData = {};
    curSnap.forEach(d => { curData[d.id] = d.data(); });
    console.log(`📸 현재 스냅샷: ${curSnap.size}개 문서\n`);

    // 백업 저장
    const outPath = path.join(
      __dirname,
      '..',
      'data',
      `recipes-recovery-${readTimeIso.replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(outPath, JSON.stringify(oldData, null, 2));
    console.log(`💾 과거 스냅샷 저장: ${outPath}\n`);

    // 비교: title/description/ingredients/steps 변경 감지
    const fieldsToCheck = ['title', 'description', 'ingredients', 'steps', 'image', 'category', 'time', 'difficulty', 'calories'];
    const changed = [];
    for (const id of Object.keys(oldData)) {
      const o = oldData[id];
      const c = curData[id];
      if (!c) { changed.push({ id, title: o.title, reason: 'DELETED' }); continue; }
      const diff = [];
      for (const f of fieldsToCheck) {
        const ov = JSON.stringify(o[f] ?? null);
        const cv = JSON.stringify(c[f] ?? null);
        if (ov !== cv) diff.push(f);
      }
      if (diff.length) changed.push({ id, title: o.title, diff });
    }

    if (!changed.length) {
      console.log('✅ 변경된 문서 없음.');
    } else {
      console.log(`⚠️  변경된 문서 ${changed.length}개:\n`);
      changed.forEach(c => {
        console.log(`  [${c.id}] ${c.title}`);
        if (c.reason) console.log(`       → ${c.reason}`);
        else console.log(`       변경 필드: ${c.diff.join(', ')}`);
      });
    }
  } catch (e) {
    console.error('❌ 실패:', e.message);
    process.exit(1);
  }
  process.exit(0);
})();
