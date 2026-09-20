const admin = require('firebase-admin');
const sa = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'cookingbasedyw.firebasestorage.app' });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });
(async () => {
  const ids = ['182','183','184','185','186','187','188','189','190'];
  for (const id of ids) {
    const doc = await db.collection('recipes').doc(id).get();
    if (!doc.exists) { console.log(`[${id}] NOT_FOUND`); continue; }
    const d = doc.data();
    const stepCount = d.steps?.length || 0;
    const stepsWithImage = d.steps?.filter(s => s.imageUrl).length || 0;
    const hasMain = !!d.image;
    console.log(`[${id}] ${d.title.padEnd(15)} | main:${hasMain ? '✅' : '❌'} | steps: ${stepsWithImage}/${stepCount}`);
  }
  process.exit(0);
})();
