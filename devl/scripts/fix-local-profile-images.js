/**
 * 개발 서버(Metro) 주소로 저장된 프로필 이미지 URL을 'default' 로 되돌린다.
 *
 * 앱에서 번들 이미지를 require() 로 불러오면 개발 중에는
 *   http://192.168.x.x:8081/assets/?unstable_path=./assets/girl.png...
 * 같은 사설 IP URL이 나온다. 그게 users.profileImage 에 저장됐고,
 * 후기를 쓸 때 authorProfileImage 로 복사되면서 번졌다.
 *
 * 그 주소는 개발 PC 안에서만 열리므로 다른 기기에서는 이미지가 안 뜨고,
 * 값이 비어 있지도 않아서 "닉네임 첫 글자" 폴백도 타지 않는다.
 * 결과적으로 회색 빈 원만 보인다.
 *
 * 'default' 로 바꾸면 기존 렌더링 코드의 폴백이 그대로 작동한다.
 *
 * 사용:
 *   node scripts/fix-local-profile-images.js            # 대상만 출력
 *   node scripts/fix-local-profile-images.js --execute  # 실제 수정
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const EXECUTE = process.argv.includes('--execute');
const BATCH = 400;

/** 사설망·로컬호스트 주소인지. 이런 URL은 다른 기기에서 절대 안 열린다. */
function isLocalUrl(u) {
  return /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|127\.|localhost)/.test(u || '');
}

async function fixCollection(name, field, replacement) {
  const snap = await db.collection(name).get();
  const targets = snap.docs.filter((d) => isLocalUrl(d.data()[field]));
  console.log(`\n[${name}.${field}] 전체 ${snap.size}건 중 대상 ${targets.length}건`);
  targets.slice(0, 3).forEach((d) => {
    console.log(`   예: ${d.id} → ${String(d.data()[field]).slice(0, 70)}…`);
  });
  if (!targets.length) return 0;

  if (!EXECUTE) return targets.length;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = db.batch();
    targets.slice(i, i + BATCH).forEach((d) => batch.update(d.ref, { [field]: replacement }));
    await batch.commit();
  }
  console.log(`   ✅ ${targets.length}건을 '${replacement}' 로 변경`);
  return targets.length;
}

(async () => {
  // 후기는 'default' 로 — 렌더링 코드가 이 값을 폴백 신호로 쓴다.
  const a = await fixCollection('reviews', 'authorProfileImage', 'default');
  // 유저는 'default' 로 두면 성별 기본 아바타가 뜬다.
  const b = await fixCollection('users', 'profileImage', 'default');

  console.log(`\n합계 ${a + b}건`);
  if (!EXECUTE) console.log('(DRY-RUN) 실제로 바꾸려면 --execute 를 붙이세요.');
  process.exit(0);
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
