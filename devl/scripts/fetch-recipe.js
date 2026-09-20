/**
 * 특정 title의 community_recipes 레시피 1건을 Firestore에서 가져와 콘솔 출력.
 * 실행: node scripts/fetch-recipe.js "매콤한 김치찌개"
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

(async () => {
  const keyword = process.argv[2] || '김치';
  const collections = ['community', 'recipes'];
  let found = false;
  for (const col of collections) {
    try {
      const snap = await db.collection(col).get();
      if (snap.empty) {
        console.log(`  (${col}: 비어있음 또는 미존재)`);
        continue;
      }
      console.log(`\n📂 ${col}: ${snap.size}개 문서`);
      snap.forEach(doc => {
        const data = doc.data();
        const title = data.title || '(no title)';
        if (title.includes(keyword)) {
          console.log(`\n── 매칭: id=${doc.id} title="${title}" ──`);
          console.log(JSON.stringify({ id: doc.id, ...data }, null, 2));
          found = true;
        } else {
          console.log(`  · ${doc.id} ${title}`);
        }
      });
    } catch (e) {
      console.log(`  (${col}: 에러 ${e.message})`);
    }
  }
  if (!found) {
    console.log(`\n❌ "${keyword}" 제목에 포함된 문서를 찾지 못했습니다.`);
  }
  process.exit(0);
})();
