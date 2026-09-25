/**
 * Firestore recipes 컬렉션에서 지정한 id 하나만 삭제한다.
 *
 * delete-recipes-cleanup.js 는 '보존 목록 외 전부 삭제'라 단건 정리에 쓸 수 없다.
 * 실수로 전체를 날리는 사고를 막으려고 단건 전용으로 따로 둔다.
 *
 * 기본은 DRY-RUN. 실제 삭제는 --execute 를 붙인다.
 *
 *   node scripts/delete-recipe.js 204            # 무엇이 지워지는지만 출력
 *   node scripts/delete-recipe.js 204 --execute  # 실제 삭제
 *
 * Storage 이미지는 지우지 않는다. image/imageUrl 이 남아 있으면 경고만 하고
 * 중단하므로, 이미지가 붙은 레시피는 먼저 Storage 를 정리한 뒤 다시 실행한다.
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const id = args.find(a => !a.startsWith('--'));

if (!id) {
  console.error('사용법: node scripts/delete-recipe.js <id> [--execute]');
  process.exit(1);
}

(async () => {
  const ref = db.collection('recipes').doc(id);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log(`ℹ️  id=${id} 문서가 이미 없습니다.`);
    process.exit(0);
  }

  const d = snap.data();
  const stepImgs = (d.steps || []).filter(s => s.imageUrl).length;
  console.log(`\n🗑  삭제 대상: [${id}] ${d.title}`);
  console.log(`   카테고리 ${d.category} · 단계 ${(d.steps || []).length}개`);
  console.log(`   대표 이미지 ${d.image ? '있음' : '없음'} · 단계 이미지 ${stepImgs}개`);

  if (d.image || stepImgs > 0) {
    console.error('\n❌ Storage 이미지가 연결돼 있습니다. 먼저 Storage 정리 후 다시 실행하세요.');
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log('\n(DRY-RUN) 실제로 지우려면 --execute 를 붙이세요.');
    process.exit(0);
  }

  await ref.delete();
  const after = await ref.get();
  console.log(after.exists ? '\n❌ 삭제 실패' : `\n✅ id=${id} 삭제 완료`);
  process.exit(after.exists ? 1 : 0);
})().catch(e => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
