/**
 * recipes / community 컬렉션의 모든 step 중 imageUrl이 있는 것에
 * isAiImage: true 만 추가. 다른 어떤 필드도 변경하지 않음.
 *
 * 안전 보장:
 *   1. 각 doc을 runTransaction으로 처리 → 사용자가 동시 편집 중이어도 자동 재시도
 *   2. 트랜잭션 내부에서 'before/after diff' 검증 — isAiImage 외 단 1바이트라도 다르면 throw
 *   3. updatedAt 같은 메타필드도 건드리지 않음 (사용자가 "데이터 절대 안바뀜" 요구)
 *   4. dry-run 기본, --apply 명시해야 실제 쓰기
 *
 * 실행: node scripts/mark-all-steps-ai.js          (dry-run, 미리보기)
 *       node scripts/mark-all-steps-ai.js --apply  (실제 적용)
 */
const admin = require('firebase-admin');
const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const apply = process.argv.includes('--apply');

/**
 * 새 steps 배열을 만들어 반환. imageUrl 있는 step에 isAiImage:true만 추가.
 * 기존 isAiImage 값이 이미 true면 그대로 유지 (변경 없음).
 */
function buildNewSteps(steps) {
  let mutated = false;
  let flagged = 0;
  const newSteps = steps.map((s) => {
    if (!s || typeof s !== 'object') return s;
    if (!s.imageUrl) return s;          // 이미지 없는 step은 건너뜀
    if (s.isAiImage === true) return s;  // 이미 true면 변경 없음
    mutated = true;
    flagged++;
    return { ...s, isAiImage: true };
  });
  return { newSteps, mutated, flagged };
}

/**
 * isAiImage 필드만 추가됐는지 검증. 다른 필드가 1개라도 다르면 throw.
 */
function assertOnlyIsAiImageAdded(beforeSteps, afterSteps) {
  if (beforeSteps.length !== afterSteps.length) {
    throw new Error(`steps length 변경됨: ${beforeSteps.length} → ${afterSteps.length}`);
  }
  for (let i = 0; i < beforeSteps.length; i++) {
    const a = beforeSteps[i] || {};
    const b = afterSteps[i] || {};
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    // b는 a + 'isAiImage'만 있어야 함
    for (const k of bKeys) {
      if (k === 'isAiImage') continue;
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
        throw new Error(`step[${i}].${k} 값 변경됨: ${JSON.stringify(a[k])} → ${JSON.stringify(b[k])}`);
      }
    }
    for (const k of aKeys) {
      if (!(k in b)) {
        throw new Error(`step[${i}].${k} 사라짐`);
      }
    }
    // isAiImage 가 true 가 아니면 의도와 다름
    if ('isAiImage' in b && b.isAiImage !== true && b.isAiImage !== a.isAiImage) {
      throw new Error(`step[${i}].isAiImage 가 true 가 아님: ${b.isAiImage}`);
    }
  }
}

async function processDocWithTx(collectionName, docId, label) {
  return db.runTransaction(async (tx) => {
    const ref = db.collection(collectionName).doc(docId);
    const snap = await tx.get(ref);
    if (!snap.exists) return { skipped: 'not_exists' };
    const data = snap.data();
    const steps = data.steps;
    if (!Array.isArray(steps) || steps.length === 0) return { skipped: 'no_steps' };

    const { newSteps, mutated, flagged } = buildNewSteps(steps);
    if (!mutated) return { skipped: 'nothing_to_flag' };

    // 검증: isAiImage 외 어떤 필드도 안 바뀜
    assertOnlyIsAiImageAdded(steps, newSteps);

    if (apply) {
      // steps 필드만 update. updatedAt 등 다른 필드 일절 건드리지 않음.
      tx.update(ref, { steps: newSteps });
    }
    return { flagged, title: data.title || label };
  });
}

async function processCollection(name) {
  // 우선 collection 전체에서 doc id 만 수집 (read-only).
  // 이후 각 doc 을 트랜잭션으로 개별 처리.
  const snap = await db.collection(name).select('title').get();
  console.log(`\n📂 ${name} — 총 ${snap.size}개 문서 검사`);

  const results = [];
  for (const d of snap.docs) {
    try {
      const res = await processDocWithTx(name, d.id, d.id);
      results.push({ id: d.id, ...res });
    } catch (e) {
      console.error(`  ❌ [${d.id}] 실패: ${e.message}`);
      results.push({ id: d.id, error: e.message });
    }
  }

  const flagged = results.filter(r => r.flagged);
  const skipped = results.filter(r => r.skipped);
  const errors = results.filter(r => r.error);

  console.log(`  • 변경${apply ? '됨' : ' 예정'}: ${flagged.length}개 doc, ${flagged.reduce((s, r) => s + r.flagged, 0)}개 step`);
  for (const r of flagged) console.log(`    [${r.id}] ${r.title} (+${r.flagged})`);
  console.log(`  • 건너뜀: ${skipped.length} (no_steps/nothing_to_flag/not_exists)`);
  if (errors.length) console.log(`  • ❌ 에러: ${errors.length}개 — 위 로그 확인`);
}

(async () => {
  console.log(apply ? '🚀 적용 모드 (--apply)' : '🔍 dry-run (실제 쓰기 없음)');
  await processCollection('recipes');
  await processCollection('community');
  if (!apply) {
    console.log(`\n실제 적용: node scripts/mark-all-steps-ai.js --apply`);
  } else {
    console.log(`\n✅ 완료. 트랜잭션 + diff 검증으로 isAiImage 외 어떤 데이터도 변경되지 않음.`);
  }
  process.exit(0);
})().catch(e => { console.error('❌', e); process.exit(1); });
