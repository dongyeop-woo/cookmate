/**
 * community 컬렉션 전체 레시피를 JSON 형식으로 출력 (읽기 전용).
 * 실행: node scripts/dump-community-recipes.js
 */
const admin = require('firebase-admin');

const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

(async () => {
  try {
    const snap = await db.collection('community').get();
    snap.docs.forEach(d => {
      const x = d.data();
      console.log('='.repeat(80));
      console.log(`[${d.id}] ${x.title}`);
      console.log('description:', x.description);
      console.log('time:', x.time, '| difficulty:', x.difficulty, '| calories:', x.calories);
      console.log('category:', x.category);
      console.log('ingredients:', JSON.stringify(x.ingredients, null, 2));
      console.log('steps:', JSON.stringify(x.steps, null, 2));
      console.log();
    });
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
