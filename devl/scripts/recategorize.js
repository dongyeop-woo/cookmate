/**
 * Firestore recipes 컬렉션의 category 필드만 일괄 업데이트.
 * 다른 필드(title, ingredients, steps, image 등)는 절대 건드리지 않음.
 *
 * 검수 완료 잠금 ID: 37, 38, 67, 68, 69, 70, 71, 72, 73, 74, 75
 *   → 이 ID들은 변경 맵에 포함되지 않으며, 포함되어 있어도 스킵.
 *
 * 실행: node scripts/recategorize.js          (dry-run, 미리보기)
 *       node scripts/recategorize.js --apply  (실제 업데이트)
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const LOCKED_IDS = new Set(['37', '38', '67', '68', '69', '70', '71', '72', '73', '74', '75']);

// id -> 새 카테고리. 한국어 카테고리명은 categories.json과 정확히 일치해야 함.
const NEW_CATEGORY = {
  // 아침으로 이동
  '78': '아침',   // 미숫가루 (was 음료)
  '84': '아침',   // 계란말이 (was 반찬)
  '136': '아침',  // 간장계란밥 (was 점심)

  // 분식
  '76': '분식',   // 떡볶이
  '79': '분식',   // 김밥
  '129': '분식',  // 쫄면
  '139': '분식',  // 짜장면
  '145': '분식',  // 라볶이
  '146': '분식',  // 로제 떡볶이
  '168': '분식',  // 충무김밥
  '169': '분식',  // 떡꼬치
  '170': '분식',  // 컵떡볶이
  '171': '분식',  // 콘도그

  // 야식
  '98': '야식',   // 부대찌개
  '100': '야식',  // 참치 김치찌개
  '102': '야식',  // 감자탕
  '106': '야식',  // 어묵탕 (description: "야식으로 최고")
  '124': '야식',  // 김치찜
  '147': '야식',  // 순대볶음 (술안주)
  '172': '야식',  // 양념치킨
  '173': '야식',  // 후라이드 치킨
  '174': '야식',  // 닭발 (description: "야식 끝판왕")
  '175': '야식',  // 곱창전골

  // 한식 (반찬·전·전통 메인)
  '80': '한식',   // 진미채볶음 (was 반찬)
  '81': '한식',   // 멸치볶음
  '83': '한식',   // 감자볶음
  '89': '한식',   // 콩나물무침
  '90': '한식',   // 시금치무침
  '93': '한식',   // 미역줄기볶음
  '94': '한식',   // 마늘종볶음
  '95': '한식',   // 미역국
  '96': '한식',   // 소고기 뭇국
  '104': '한식',  // 삼계탕
  '110': '한식',  // 소불고기
  '113': '한식',  // 안동 찜닭
  '114': '한식',  // 수육
  '118': '한식',  // 잡채
  '140': '한식',  // 김치전
  '141': '한식',  // 해물파전
  '178': '한식',  // 찜닭
  '179': '한식',  // 보쌈

  // 양식
  '121': '양식',  // 찹스테이크
  '130': '양식',  // 알리오 올리오 파스타
  '131': '양식',  // 크림 파스타
  '132': '양식',  // 토마토 파스타

  // 디저트
  '149': '디저트', // 군고구마
  '155': '디저트', // 딸기청
  '160': '디저트', // 티라미수
  '161': '디저트', // 바스크 치즈케이크
  '162': '디저트', // 브라우니
  '163': '디저트', // 마들렌

  // 간식
  '134': '간식',  // 유부초밥
  '135': '간식',  // 참치 주먹밥
  '142': '간식',  // 부추전
  '143': '간식',  // 감자전
  '150': '간식',  // 키토김밥
  '152': '간식',  // 닭가슴살 샐러드
  // 144 애호박전은 이미 간식이라 변경 불필요
};

const apply = process.argv.includes('--apply');

(async () => {
  const snap = await db.collection('recipes').get();

  const changes = [];
  const skippedLocked = [];

  for (const doc of snap.docs) {
    const id = doc.id;
    const cur = doc.data().category || '(없음)';
    const next = NEW_CATEGORY[id];

    if (LOCKED_IDS.has(id)) {
      if (next && next !== cur) {
        skippedLocked.push({ id, cur, attempted: next });
      }
      continue;
    }
    if (!next) continue;            // 변경 대상 아님
    if (next === cur) continue;     // 이미 같은 카테고리

    changes.push({ id, title: doc.data().title, cur, next });
  }

  console.log(`📋 변경 대상 ${changes.length}개:`);
  for (const c of changes) {
    console.log(`  [${c.id}] ${c.title}: ${c.cur} → ${c.next}`);
  }
  if (skippedLocked.length) {
    console.log(`\n⚠️  잠금 ID 변경 시도 무시 ${skippedLocked.length}건:`);
    for (const s of skippedLocked) console.log(`  [${s.id}] ${s.cur} → ${s.attempted} (skip)`);
  }

  if (!apply) {
    console.log(`\n🔍 dry-run 종료. 실제 적용하려면: node scripts/recategorize.js --apply`);
    process.exit(0);
  }

  console.log(`\n🚀 적용 시작...`);
  const batch = db.batch();
  const now = new Date().toISOString();
  for (const c of changes) {
    const ref = db.collection('recipes').doc(c.id);
    batch.update(ref, { category: c.next, updatedAt: now });
  }
  await batch.commit();
  console.log(`✅ ${changes.length}개 update 완료`);
  process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
