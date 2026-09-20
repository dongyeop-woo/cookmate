/**
 * 현재 Firestore의 tags 데이터 통계 — 어떤 레시피에 어떤 태그 있는지 미리 보기.
 * 읽기 전용.
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

(async () => {
  const snap = await db.collection('recipes').get();
  let withTags = 0;
  const tagCount = {};
  for (const d of snap.docs) {
    const tags = d.data().tags;
    if (Array.isArray(tags) && tags.length > 0) {
      withTags++;
      for (const t of tags) tagCount[t] = (tagCount[t] || 0) + 1;
    }
  }
  console.log(`총 레시피: ${snap.size}, 태그 있음: ${withTags}, 없음: ${snap.size - withTags}`);
  if (Object.keys(tagCount).length) {
    console.log('\n현재 사용 중인 태그:');
    Object.entries(tagCount).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => console.log(`  #${t} (${c})`));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
