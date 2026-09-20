/**
 * 태그 큐레이션용 — 모든 레시피의 핵심 필드만 dump.
 * 읽기 전용. 결과를 ./data/recipes-tagging.json 으로 저장.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

(async () => {
  const snap = await db.collection('recipes').get();
  const rows = snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id,
      title: x.title,
      category: x.category,
      time: x.time,
      difficulty: x.difficulty,
      description: x.description,
      ingredients: (x.ingredients || []).map(i => i.name),
    };
  }).sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

  fs.writeFileSync('./data/recipes-tagging.json', JSON.stringify(rows, null, 2));
  console.log(`✅ ${rows.length}개 레시피 ./data/recipes-tagging.json 저장 완료`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
