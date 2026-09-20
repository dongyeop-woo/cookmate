/**
 * recipe-image-prompts.md 의 프롬프트로 Gemini 이미지 생성.
 *
 * 사용법:
 *   GEMINI_API_KEY=xxx node scripts/gen-recipe-images.js <recipe_id> [step|all]
 *
 * 예:
 *   node scripts/gen-recipe-images.js 181            # Step 9(완성샷) 1장만
 *   node scripts/gen-recipe-images.js 181 5          # Step 5만
 *   node scripts/gen-recipe-images.js 181 all        # Step 1~9 전체 (9 × ~57원 ≈ 510원)
 *
 * 결과:
 *   images/recipe_181_step_9.png 등
 *
 * 환경변수:
 *   GEMINI_API_KEY        (필수)
 *   GEMINI_IMAGE_MODEL    (선택, 기본: gemini-3.1-flash-image-preview / Nano Banana 2)
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const PROMPTS_FILE = path.join(__dirname, '..', 'data', 'recipe-image-prompts.md');
const OUTPUT_DIR = path.join(__dirname, '..', 'images');
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';

/**
 * recipe-image-prompts.md를 파싱해서 특정 recipe id의 모든 Step 프롬프트 추출.
 * "## ... (id: 181)" 헤더를 찾고, 다음 "##" 또는 EOF까지를 해당 레시피의 영역으로 본다.
 * 그 영역 안에서 "**Step N.** ..." 라인을 step 번호별로 모아 반환.
 */
function parsePrompts(recipeId) {
  const md = fs.readFileSync(PROMPTS_FILE, 'utf8');
  const lines = md.split('\n');

  const headerRe = new RegExp(`^##\\s+.*\\(id:\\s*${recipeId}\\)\\s*$`);
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error(`recipe id=${recipeId} 의 프롬프트를 ${PROMPTS_FILE} 에서 찾을 수 없습니다.`);
  }
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  const region = lines.slice(startIdx, endIdx).join('\n');
  // **Step N.** ... (다음 빈 줄 또는 다음 **Step 까지)
  const stepRe = /\*\*Step\s+(\d+)\.\*\*\s+([\s\S]*?)(?=\n\n\*\*Step\s+\d+\.\*\*|\n---|\n##|\s*$)/g;
  const steps = {};
  let m;
  while ((m = stepRe.exec(region)) !== null) {
    const n = parseInt(m[1], 10);
    steps[n] = m[2].trim();
  }
  return steps;
}

async function generateOne(ai, prompt, outputPath) {
  const start = Date.now();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
  });
  const parts = response.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData?.data);
  if (!imagePart) {
    const textPart = parts.find(p => p.text);
    throw new Error(`이미지 데이터 없음. 응답 텍스트: ${(textPart?.text || '').slice(0, 200)}`);
  }
  const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
  fs.writeFileSync(outputPath, buffer);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const sizeKb = (buffer.length / 1024).toFixed(0);
  return { elapsed, sizeKb };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const recipeId = process.argv[2];
  const stepArg = process.argv[3] || 'last';
  if (!recipeId) {
    console.error('❌ recipe id 가 필요합니다. 예: node scripts/gen-recipe-images.js 181');
    process.exit(1);
  }

  const steps = parsePrompts(recipeId);
  const stepNums = Object.keys(steps).map(Number).sort((a, b) => a - b);
  if (stepNums.length === 0) {
    console.error(`❌ recipe id=${recipeId} 의 step 프롬프트를 찾을 수 없습니다.`);
    process.exit(1);
  }

  let targets;
  if (stepArg === 'all') {
    targets = stepNums;
  } else if (stepArg === 'last') {
    targets = [stepNums[stepNums.length - 1]];
  } else {
    const n = parseInt(stepArg, 10);
    if (!steps[n]) {
      console.error(`❌ Step ${n} 이 해당 레시피에 없습니다. 사용 가능: ${stepNums.join(', ')}`);
      process.exit(1);
    }
    targets = [n];
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`🎨 모델: ${MODEL}`);
  console.log(`📋 recipe id=${recipeId}, 생성할 step: ${targets.join(', ')}`);
  console.log('');

  const ai = new GoogleGenAI({ apiKey });

  for (const n of targets) {
    const prompt = steps[n];
    const outputPath = path.join(OUTPUT_DIR, `recipe_${recipeId}_step_${n}.png`);
    console.log(`▶ Step ${n} 생성 중... (프롬프트 ${prompt.length}자)`);
    try {
      const { elapsed, sizeKb } = await generateOne(ai, prompt, outputPath);
      console.log(`  ✅ ${elapsed}초, ${sizeKb}KB → ${path.relative(process.cwd(), outputPath)}`);
    } catch (e) {
      console.error(`  ❌ Step ${n} 실패: ${e?.message || e}`);
    }
  }

  console.log('');
  console.log('확인:');
  console.log(`  open images/recipe_${recipeId}_step_*.png`);
}

main().catch(e => {
  console.error('❌ 실패:', e?.message || e);
  process.exit(1);
});
