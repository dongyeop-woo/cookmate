/**
 * Firestore recipes 컬렉션에서 보존 목록 외 모두 삭제.
 * community 컬렉션은 전부 보존 (건드리지 않음).
 *
 * 기본은 DRY-RUN (실제 삭제 안 함, 대상만 출력).
 * 실제 삭제하려면 --execute 플래그 사용.
 *
 * 실행:
 *   node scripts/delete-recipes-cleanup.js            # dry-run
 *   node scripts/delete-recipes-cleanup.js --execute  # 실제 삭제
 */
const admin = require('firebase-admin');

const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

// recipes 컬렉션에서 보존할 ID 목록 (이 외 모두 삭제)
const KEEP_RECIPE_IDS = new Set(['37', '38', '67']);

const EXECUTE = process.argv.includes('--execute');

(async () => {
  try {
    const snap = await db.collection('recipes').get();
    const toDelete = [];
    const toKeep = [];

    snap.docs.forEach(d => {
      const row = { id: d.id, title: d.data().title || '(제목 없음)' };
      if (KEEP_RECIPE_IDS.has(d.id)) toKeep.push(row);
      else toDelete.push(row);
    });

    console.log(`\n📊 recipes 컬렉션 현황: 총 ${snap.size}개`);
    console.log(`   ✅ 보존: ${toKeep.length}개`);
    console.log(`   🗑  삭제: ${toDelete.length}개\n`);

    console.log('✅ 보존 대상:');
    toKeep.forEach(r => console.log(`   [${r.id}] ${r.title}`));

    console.log('\n🗑  삭제 대상:');
    toDelete.forEach(r => console.log(`   [${r.id}] ${r.title}`));

    if (!EXECUTE) {
      console.log('\n⚠️  DRY-RUN 모드 — 실제 삭제 안 함.');
      console.log('   실제 삭제: node scripts/delete-recipes-cleanup.js --execute\n');
      process.exit(0);
    }

    console.log('\n🔥 실제 삭제 실행 중...');
    const BATCH_LIMIT = 400;
    for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
      const chunk = toDelete.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach(r => {
        batch.delete(db.collection('recipes').doc(r.id));
      });
      await batch.commit();
      console.log(`   → ${Math.min(i + BATCH_LIMIT, toDelete.length)}/${toDelete.length} 삭제 완료`);
    }
    console.log(`\n✅ ${toDelete.length}개 레시피 삭제 완료. community 컬렉션은 건드리지 않음.`);
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
