/**
 * recipes.json 전체를 Firestore에 일괄 upsert 하는 안전한 스크립트.
 * - 기존 recipes 컬렉션의 문서를 "삭제"하지 않음
 * - ID가 같으면 merge, 없으면 새로 생성
 * - 다른 컬렉션(users, community_recipes 등)은 절대 건드리지 않음
 *
 * 실행: node scripts/seed-recipes-all.js
 */
const admin = require('firebase-admin');

const recipes = require('../data/recipes.json');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

async function seedAll() {
  console.log(`📂 recipes.json 로드: ${recipes.length}개`);
  const now = new Date().toISOString();

  const BATCH_LIMIT = 400;
  let created = 0;
  let updated = 0;

  for (let i = 0; i < recipes.length; i += BATCH_LIMIT) {
    const chunk = recipes.slice(i, i + BATCH_LIMIT);
    const refs = chunk.map(r => db.collection('recipes').doc(r.id));
    const snaps = await db.getAll(...refs);

    const batch = db.batch();
    chunk.forEach((recipe, idx) => {
      const snap = snaps[idx];
      const payload = {
        title: recipe.title,
        author: recipe.author,
        time: recipe.time,
        difficulty: recipe.difficulty,
        calories: recipe.calories || 0,
        rating: recipe.rating || 0,
        likes: recipe.likes || 0,
        bookmarks: recipe.bookmarks || 0,
        image: recipe.image,
        category: recipe.category,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        updatedAt: now,
      };
      if (!snap.exists) {
        payload.createdAt = now;
        created++;
      } else {
        updated++;
      }
      batch.set(refs[idx], payload, { merge: true });
    });

    await batch.commit();
    console.log(`  → ${Math.min(i + BATCH_LIMIT, recipes.length)}/${recipes.length} 처리 완료`);
  }

  console.log(`✅ 완료: 신규 ${created}개 / 업데이트 ${updated}개`);
}

(async () => {
  try {
    await seedAll();
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
