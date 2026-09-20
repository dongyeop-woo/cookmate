/**
 * 카테고리만 Firestore에 upsert 하는 안전한 스크립트.
 * 레시피/유저 등 다른 컬렉션은 건드리지 않습니다.
 * 실행: node scripts/seed-categories.js
 */

const admin = require('firebase-admin');

const categories = require('../data/categories.json');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

async function seedCategories() {
  console.log(`📂 카테고리 ${categories.length}개 upsert 시작...`);
  const batch = db.batch();

  for (const cat of categories) {
    const ref = db.collection('categories').doc(cat.id);
    batch.set(
      ref,
      {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        order: parseInt(cat.id, 10),
      },
      { merge: true }
    );
    console.log(`  • ${cat.id} ${cat.name}`);
  }

  await batch.commit();
  console.log(`✅ 카테고리 upsert 완료 (${categories.length}개)`);
}

(async () => {
  try {
    await seedCategories();
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
