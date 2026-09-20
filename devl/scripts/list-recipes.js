/**
 * Firestore recipes 컬렉션 전체를 읽어 id·title·description 을 출력.
 * 읽기 전용 — 데이터를 절대 수정하지 않음.
 *
 * 실행: node scripts/list-recipes.js
 */
const admin = require('firebase-admin');

const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

async function listCollection(name) {
  const snap = await db.collection(name).get();
  const rows = snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      title: x.title || x.name || '(제목 없음)',
      description: (x.description || '').slice(0, 80),
      author: x.author || x.authorId || x.authorUid || '',
    };
  });
  rows.sort((a, b) => {
    const ai = parseInt(a.id, 10);
    const bi = parseInt(b.id, 10);
    if (!isNaN(ai) && !isNaN(bi)) return ai - bi;
    return a.id.localeCompare(b.id);
  });
  console.log(`\n📂 ${name}: 총 ${rows.length}개\n`);
  for (const r of rows) {
    const authorPart = r.author ? `  (by ${r.author})` : '';
    console.log(`[${r.id}] ${r.title}${authorPart}`);
    if (r.description) console.log(`    → ${r.description}`);
  }
}

(async () => {
  try {
    console.log('🔍 모든 최상위 컬렉션 스캔 중...');
    const collections = await db.listCollections();
    console.log(`발견된 컬렉션: ${collections.map(c => c.id).join(', ')}\n`);
    for (const c of collections) {
      if (c.id.toLowerCase().includes('recipe') || c.id.toLowerCase().includes('post') || c.id === 'community') {
        await listCollection(c.id);
      }
    }
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
