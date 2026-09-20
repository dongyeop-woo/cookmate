/**
 * Firestore recipes 컬렉션을 카테고리별로 그룹화해서 출력 (읽기 전용).
 * 실행: node scripts/list-categories.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

(async () => {
  const snap = await db.collection('recipes').get();
  const byCat = {};
  for (const d of snap.docs) {
    const x = d.data();
    const cat = x.category || '(없음)';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({ id: d.id, title: x.title });
  }

  for (const cat of Object.keys(byCat).sort()) {
    console.log(`\n📂 ${cat}: ${byCat[cat].length}개`);
    byCat[cat].sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));
    for (const r of byCat[cat]) {
      console.log(`  [${r.id}] ${r.title}`);
    }
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
