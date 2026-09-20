/**
 * community 컬렉션 4개 레시피의 description/steps 보완.
 * 기본 DRY-RUN. 실제 적용: --execute
 *
 * 실행:
 *   node scripts/update-community-recipes.js            # dry-run
 *   node scripts/update-community-recipes.js --execute  # 실제 수정
 */
const admin = require('firebase-admin');

const serviceAccount = require('../cookingbasedyw-firebase-adminsdk-fbsvc-b11f8d8de0.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ databaseId: 'cookmate' });

const EXECUTE = process.argv.includes('--execute');

const UPDATES = {
  // 아이스 아메리카노
  'Ior1VR4dwHvKrVZ1BNto': {
    description: '집에서 쉽게 만드는 깔끔한 아이스 아메리카노. 에스프레소 농도를 조절해 내 입맛에 딱 맞게!',
    steps: [
      {
        step: 1,
        description: '준비한 빈 컵에 에스프레소 60ml를 부어주세요. 에스프레소 머신이 없다면 블랙커피스틱 2개로 대체해도 괜찮아요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 2,
        description: '가루가 충분히 잠길 정도로만 뜨거운 물을 살짝 붓고 티스푼으로 완전히 녹여주세요. 이렇게 먼저 녹여야 얼음 위에서도 가루가 뭉치지 않아요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 3,
        description: '커피 원액이 든 컵에 얼음 1컵을 가득 채워주세요. 얼음이 많을수록 끝까지 시원하게 즐길 수 있어요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 4,
        description: '차가운 물 250ml를 부어 농도를 맞춘 뒤 가볍게 저어주세요. 물 양을 늘리면 연하게, 줄이면 진하게 취향대로 조절 가능해요.',
        time: 0,
        imageUrl: null,
      },
    ],
  },

  // 된장찌개
  'S6NTMyovqsSrASceOSk8': {
    description: '기본 된장에 쌈장을 더해 간을 한층 살린 홈메이드 된장찌개. 재료 손질만 끝나면 20분이면 완성!',
    steps: [
      {
        step: 1,
        description: '냄비에 물 100ml를 붓고 된장 크게 1숟갈·쌈장 1/2숟갈을 덩어리 없이 곱게 풀어주세요. 적은 물에 먼저 풀어야 덩어리가 남지 않아요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 2,
        description: '양념이 잘 풀렸으면 나머지 물 400ml를 마저 붓고 중강불에서 보글보글 끓여주세요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 3,
        description: '국물이 끓어오르면 애호박 1/2개·양파 1/2개를 넣고 3분간 익혀주세요. 단단한 채소 먼저 넣어야 국물에 단맛이 배어나요.',
        time: 3,
        imageUrl: null,
      },
      {
        step: 4,
        description: '채소가 살짝 익어가면 새송이버섯 2꼭지를 썰어 넣어 풍미를 더해주세요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 5,
        description: '깍둑썰기한 두부 1/2모와 고춧가루 1스푼을 넣어 색감과 칼칼함을 살려주세요. 두부는 이쯤 넣어야 뭉그러지지 않아요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 6,
        description: '송송 썬 대파 1/4대를 넣어주세요. 매콤하게 즐기려면 이때 청양고추 1~2개도 썰어 함께 넣으세요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 7,
        description: '마지막으로 팽이버섯 1봉지를 찢어 보기 좋게 올리고 한소끔 끓여 완성하세요. 팽이버섯은 금방 익으니 불 끄기 직전에 올리는 게 좋아요.',
        time: 0,
        imageUrl: null,
      },
    ],
  },

  // 아이스 카페 라떼
  'cKxgsZBt8FanScra8QQ0': {
    description: '우유와 에스프레소가 예쁜 2단 층으로 나뉘는 홈카페 아이스 라떼. 5분이면 카페 감성 한 잔!',
    steps: [
      {
        step: 1,
        description: '준비된 컵에 얼음 1컵을 가득 채워주세요. 얼음이 많아야 에스프레소가 천천히 흘러내려 층이 예쁘게 만들어져요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 2,
        description: '컵의 약 3/4 지점까지 차가운 우유 120ml를 부어주세요. 우유가 차가울수록 층이 더 선명하게 나뉩니다.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 3,
        description: '에스프레소 60ml를 얼음 위에 천천히 부어주세요. 얼음을 타고 떨어져야 자연스러운 2단 층이 완성돼요.',
        time: 0,
        imageUrl: null,
      },
    ],
  },

  // 계란 스크램블
  'it3RLLG1lZ8atL1OSvIV': {
    description: '우유와 버터로 풍미를 살린 촉촉한 정통 스크램블. 10분이면 호텔 조식 느낌의 아침이 완성!',
    calories: 250,
    steps: [
      {
        step: 1,
        description: '볼에 달걀 3개를 깨뜨려 담고 종이컵 반컵 분량의 우유를 부어주세요. 우유가 스크램블을 촉촉하게 만드는 비결이에요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 2,
        description: '설탕 1/3티스푼·소금 1/3티스푼을 넣고 알끈이 보이지 않을 때까지 잘 저어주세요. 설탕은 단맛이 아닌 감칠맛을 올려줍니다.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 3,
        description: '팬을 중불에 1분간 올려 충분히 달궈주세요. 팬이 뜨거워야 달걀이 들러붙지 않아요.',
        time: 1,
        imageUrl: null,
      },
      {
        step: 4,
        description: '버터 1/3스푼을 올려 천천히 녹여주세요. 버터가 노릇해지기 직전이 가장 향이 좋아요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 5,
        description: '버터가 어느 정도 녹았다면 불을 약불로 줄이고 달걀물을 팬에 부어주세요. 약불을 유지해야 타지 않고 촉촉하게 익어요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 6,
        description: '팬을 살짝 기울여 바닥의 익은 달걀을 주걱으로 안쪽으로 모아주세요. 덩어리를 크게 살살 굴려야 촉촉한 식감이 살아나요.',
        time: 0,
        imageUrl: null,
      },
      {
        step: 7,
        description: '70% 정도 물렁하게 익었을 때 그릇에 옮기고 후추를 뿌려 완성하세요. 팬에서 더 익히지 말고 여열로 마무리하는 게 포인트!',
        time: 0,
        imageUrl: null,
      },
    ],
  },
};

(async () => {
  try {
    for (const [docId, payload] of Object.entries(UPDATES)) {
      const ref = db.collection('community').doc(docId);
      const snap = await ref.get();
      if (!snap.exists) {
        console.log(`⚠️  [${docId}] 문서 없음 — 건너뜀`);
        continue;
      }
      const before = snap.data();
      console.log('='.repeat(80));
      console.log(`[${docId}] ${before.title}`);
      console.log('변경 요약:');
      if (before.description !== payload.description) {
        console.log(`  description:`);
        console.log(`    이전: ${before.description}`);
        console.log(`    이후: ${payload.description}`);
      }
      if (payload.calories !== undefined && before.calories !== payload.calories) {
        console.log(`  calories: ${before.calories} → ${payload.calories}`);
      }
      console.log(`  steps: ${before.steps?.length ?? 0}개 → ${payload.steps.length}개 (전체 교체)`);

      if (EXECUTE) {
        await ref.set(payload, { merge: true });
        console.log('  ✅ Firestore 업데이트 완료');
      }
    }

    if (!EXECUTE) {
      console.log('\n⚠️  DRY-RUN 모드 — 실제 수정 안 함.');
      console.log('   실제 적용: node scripts/update-community-recipes.js --execute');
    } else {
      console.log('\n✅ 모든 업데이트 완료');
    }
  } catch (e) {
    console.error('❌ 실패:', e);
    process.exit(1);
  }
  process.exit(0);
})();
