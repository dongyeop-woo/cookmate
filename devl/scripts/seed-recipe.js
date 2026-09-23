/**
 * recipes.json의 특정 레시피 하나만 Firestore에 upsert 하는 안전한 스크립트.
 * 기존 레시피/유저 등 다른 데이터는 절대 건드리지 않습니다.
 *
 * 사용법:
 *   node scripts/seed-recipe.js <id>
 *   예: node scripts/seed-recipe.js 37
 *
 * id를 생략하면 recipes.json의 마지막 항목을 업로드합니다.
 */

const admin = require('firebase-admin');

const recipes = require('../data/recipes.json');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

async function seedRecipe(targetId) {
  const recipe = targetId
    ? recipes.find(r => r.id === targetId)
    : recipes[recipes.length - 1];

  if (!recipe) {
    console.error(`❌ id="${targetId}" 레시피를 recipes.json에서 찾을 수 없습니다.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const ref = db.collection('recipes').doc(recipe.id);
  const snap = await ref.get();

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
    servings: recipe.servings || '1',
    updatedAt: now,
  };
  if (!snap.exists) payload.createdAt = now;

  await ref.set(payload, { merge: true });
  console.log(`✅ ${snap.exists ? 'update' : 'create'}: id=${recipe.id} title="${recipe.title}"`);
}

(async () => {
  try {
    await seedRecipe(process.argv[2]);
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
