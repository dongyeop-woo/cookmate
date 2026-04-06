/**
 * Firestore 데이터 마이그레이션 스크립트
 * 실행: node scripts/migrate-to-firestore.js
 */

const admin = require('firebase-admin');
const path = require('path');

const recipes = require('../data/recipes.json');
const categories = require('../data/categories.json');

// 서비스 계정 키 경로
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

async function migrateCategories() {
  console.log('📂 카테고리 마이그레이션 시작...');
  const batch = db.batch();

  for (const cat of categories) {
    const ref = db.collection('categories').doc(cat.id);
    batch.set(ref, {
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      order: parseInt(cat.id),
    });
  }

  await batch.commit();
  console.log(`✅ 카테고리 ${categories.length}개 업로드 완료`);
}

async function deleteAllRecipes() {
  console.log('🗑️  기존 레시피 삭제 시작...');
  const snapshot = await db.collection('recipes').get();
  if (snapshot.empty) {
    console.log('  → 삭제할 레시피 없음');
    return;
  }

  const BATCH_SIZE = 400;
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    console.log(`  → ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length} 삭제`);
  }
  console.log(`✅ 기존 레시피 ${docs.length}개 삭제 완료`);
}

async function migrateRecipes() {
  console.log('🍳 레시피 마이그레이션 시작...');

  // Firestore batch는 500개 제한이므로 나눠서 처리
  const BATCH_SIZE = 400;
  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = recipes.slice(i, i + BATCH_SIZE);

    for (const recipe of chunk) {
      const ref = db.collection('recipes').doc(recipe.id);
      batch.set(ref, {
        title: recipe.title,
        author: recipe.author,
        time: recipe.time,
        difficulty: recipe.difficulty,
        calories: recipe.calories || 0,
        rating: recipe.rating,
        likes: recipe.likes || 0,
        bookmarks: recipe.bookmarks || 0,
        image: recipe.image,
        category: recipe.category,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    console.log(`  → ${Math.min(i + BATCH_SIZE, recipes.length)}/${recipes.length} 업로드`);
  }

  console.log(`✅ 레시피 ${recipes.length}개 업로드 완료`);
}

async function main() {
  console.log('🚀 Firestore 마이그레이션 시작\n');

  try {
    await migrateCategories();
    await deleteAllRecipes();
    await migrateRecipes();
    console.log('\n🎉 모든 마이그레이션 완료!');
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
  }

  process.exit(0);
}

main();
