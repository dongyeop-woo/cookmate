/**
 * 로컬 이미지(images/recipe_<id>_step_<n>.png)를 Firebase Storage에 업로드하고
 * recipes.json의 image / steps[].imageUrl / isAiImage 필드를 채운 뒤 Firestore에 seed.
 *
 * 사용법:
 *   node scripts/upload-and-seed-recipe.js <recipe_id>
 *
 * 전제조건:
 *   - images/recipe_<id>_step_*.png 가 존재 (gen-recipe-images.js로 사전 생성)
 *   - cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json 서비스 계정 키
 *
 * 흐름:
 *   1. recipes.json 에서 해당 recipe 찾기
 *   2. step별 이미지 파일 → Firebase Storage 업로드 → 공개 URL with download token
 *   3. recipe.image = step 마지막(완성샷) URL
 *      recipe.steps[i].imageUrl = step i+1 URL
 *      recipe.steps[i].isAiImage = true
 *   4. recipes.json 저장 (image 필드 채워진 상태)
 *   5. Firestore upsert (seed-recipe.js 와 동일 동작)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFileSync } = require('child_process');
const admin = require('firebase-admin');

const RECIPES_JSON = path.join(__dirname, '..', 'data', 'recipes.json');
const IMAGES_DIR = path.join(__dirname, '..', 'images');
const SERVICE_ACCOUNT = path.join(__dirname, '..', 'cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');
const BUCKET_NAME = 'cookingbasedyw.firebasestorage.app';

const serviceAccount = require(SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET_NAME,
});
const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });
const bucket = admin.storage().bucket();

/**
 * Firebase Storage에 이미지 업로드 후 다운로드 토큰 포함된 공개 URL 반환.
 * 기존 앱이 사용하는 패턴과 동일: recipeImages/admin_{timestamp}_{hex}.jpg
 */
/**
 * 업로드 상한. 1100 으로 잡았더니 4:5 인스타 카드(사진 영역 1080x730)와 앱
 * 상세 화면에서 확대가 생겨 흐려졌다. 1600 이면 어디서도 원본 그대로 쓴다.
 * 장당 약 215KB -> 400KB 로 늘지만 화질 손해가 더 크다.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 72;

/**
 * Flow 에서 받은 원본은 장당 2MB 가 넘는다. 그대로 올리면 기존 이미지의 20배가 되어
 * 사용자 데이터와 Storage 요금을 함께 먹는다. sips(macOS 기본 탑재)로 줄여서 올린다.
 * sips 가 없는 환경에서는 경고만 남기고 원본을 올린다.
 */
function compressToJpeg(localPath) {
  const out = path.join(os.tmpdir(), `yj_${crypto.randomBytes(6).toString('hex')}.jpg`);
  try {
    execFileSync('sips', ['-Z', String(MAX_EDGE), '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(JPEG_QUALITY), localPath, '--out', out], { stdio: 'ignore' });
    const buf = fs.readFileSync(out);
    fs.unlinkSync(out);
    return buf;
  } catch (e) {
    console.warn(`  ⚠️  압축 실패(${e.message.split('\n')[0]}) — 원본 그대로 업로드합니다.`);
    return fs.readFileSync(localPath);
  }
}

async function uploadImage(localPath, recipeId, stepNum) {
  const raw = fs.statSync(localPath).size;
  const buffer = compressToJpeg(localPath);
  process.stdout.write(`(${(raw / 1048576).toFixed(1)}MB→${Math.round(buffer.length / 1024)}KB) `);
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  const remoteName = `recipeImages/admin_${ts}_${rand}.jpg`;
  const file = bucket.file(remoteName);

  // 다운로드 토큰 — 클라이언트가 인증 없이 접근 가능
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: 'image/jpeg',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        recipeId: String(recipeId),
        step: String(stepNum),
        source: 'gemini-3.1-flash-image-preview',
      },
    },
    resumable: false,
  });

  const encodedName = encodeURIComponent(remoteName);
  const url = `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodedName}?alt=media&token=${downloadToken}`;
  return url;
}

async function main() {
  const recipeId = process.argv[2];
  if (!recipeId) {
    console.error('❌ recipe id 가 필요합니다. 예: node scripts/upload-and-seed-recipe.js 181');
    process.exit(1);
  }

  // 1. recipes.json 로드 + 대상 레시피 찾기
  const recipes = JSON.parse(fs.readFileSync(RECIPES_JSON, 'utf8'));
  const idx = recipes.findIndex(r => r.id === recipeId);
  if (idx === -1) {
    console.error(`❌ recipe id=${recipeId} 를 recipes.json에서 찾을 수 없습니다.`);
    process.exit(1);
  }
  const recipe = recipes[idx];
  const stepCount = recipe.steps.length;
  console.log(`📋 [${recipe.id}] ${recipe.title} - ${stepCount} steps`);

  // 2. 이미지 파일 존재 확인
  const imagePaths = [];
  for (let n = 1; n <= stepCount; n++) {
    const p = path.join(IMAGES_DIR, `recipe_${recipeId}_step_${n}.png`);
    if (!fs.existsSync(p)) {
      console.error(`❌ 이미지 파일 누락: ${p}`);
      console.error(`   먼저 실행: node scripts/gen-recipe-images.js ${recipeId} all`);
      process.exit(1);
    }
    imagePaths.push(p);
  }
  console.log(`✅ 이미지 ${stepCount}장 확인 완료`);

  // 3. Storage 업로드 (병렬이 아닌 순차 — 토큰 충돌 방지 + 진행 가시성)
  console.log('\n📤 Firebase Storage 업로드 중...');
  const uploadedUrls = [];
  for (let n = 1; n <= stepCount; n++) {
    process.stdout.write(`  Step ${n}: 업로드... `);
    const url = await uploadImage(imagePaths[n - 1], recipeId, n);
    console.log(`✅`);
    uploadedUrls.push(url);
  }

  // 4. recipes.json 업데이트
  console.log('\n📝 recipes.json 업데이트 중...');
  recipe.image = uploadedUrls[stepCount - 1]; // 마지막 step = 완성샷 = 메인 이미지
  recipe.steps = recipe.steps.map((s, i) => ({
    ...s,
    imageUrl: uploadedUrls[i],
    isAiImage: true,
  }));
  recipes[idx] = recipe;
  fs.writeFileSync(RECIPES_JSON, JSON.stringify(recipes, null, 4));
  console.log(`  recipe.image = ${recipe.image.slice(0, 80)}...`);
  console.log(`  steps[].imageUrl + isAiImage:true 채움`);

  // 5. Firestore seed (seed-recipe.js와 동일 로직)
  console.log('\n🔥 Firestore seed 중...');
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
  console.log(`  ${snap.exists ? '✏️  update' : '🆕 create'}: id=${recipe.id} title="${recipe.title}"`);

  console.log('\n🎉 완료!');
  console.log(`   Firestore: recipes/${recipe.id}`);
  console.log(`   메인 이미지: ${recipe.image}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ 실패:', e?.message || e);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  });
