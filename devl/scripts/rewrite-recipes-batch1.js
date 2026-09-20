/**
 * 재료 간결화 버전 — 각 레시피 재료 6~8개 이내로 압축.
 * steps의 구체적 양·이유 설명은 유지.
 */
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'data', 'recipes.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const IMG = {
  avocadoToast: 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress&cs=tinysrgb&w=800',
  scrambledEggs: 'https://images.pexels.com/photos/2067396/pexels-photo-2067396.jpeg?auto=compress&cs=tinysrgb&w=800',
  kimchiFriedRice: 'https://images.pexels.com/photos/4518843/pexels-photo-4518843.jpeg?auto=compress&cs=tinysrgb&w=800',
  jeyukBowl: 'https://images.pexels.com/photos/5837300/pexels-photo-5837300.jpeg?auto=compress&cs=tinysrgb&w=800',
  galbiJjim: 'https://images.pexels.com/photos/8477331/pexels-photo-8477331.jpeg?auto=compress&cs=tinysrgb&w=800',
  samgyeopsal: 'https://images.pexels.com/photos/7218537/pexels-photo-7218537.jpeg?auto=compress&cs=tinysrgb&w=800',
  dakBokkeumTang: 'https://images.pexels.com/photos/14620751/pexels-photo-14620751.jpeg?auto=compress&cs=tinysrgb&w=800',
  tiramisu: 'https://images.pexels.com/photos/6163263/pexels-photo-6163263.jpeg?auto=compress&cs=tinysrgb&w=800',
  brownie: 'https://images.pexels.com/photos/45202/brownie-dessert-cake-sweet-45202.jpeg?auto=compress&cs=tinysrgb&w=800',
  gamjaJeon: 'https://images.pexels.com/photos/12842910/pexels-photo-12842910.jpeg?auto=compress&cs=tinysrgb&w=800',
};

const rewrites = {
  '38': {
    id: '38', title: '아보카도 토스트', image: IMG.avocadoToast, category: '아침',
    time: 10, difficulty: '쉬움', calories: 310, rating: 4.7,
    servings: '1~2', tags: ['양식', '브런치', '건강', '다이어트', '비건'],
    description: '크리미한 아보카도에 레몬즙을 더해 상큼함을 살린 건강 토스트.\n10분이면 완성되는 카페 감성 브런치!',
    ingredients: [
      { name: '호밀빵', amount: '2장', icon: '🍞' },
      { name: '잘 익은 아보카도', amount: '1개', icon: '🥑' },
      { name: '방울토마토', amount: '6개', icon: '🍅' },
      { name: '레몬즙', amount: '1작은술', icon: '🍋' },
      { name: '올리브유', amount: '1큰술', icon: '🫒' },
      { name: '소금', amount: '약간', icon: '🧂' },
      { name: '후추', amount: '약간', icon: '⚫' },
    ],
    steps: [
      { step: 1, description: '아보카도 1개를 반으로 갈라 씨를 빼고 과육을 볼에 담아주세요. 잘 익은 아보카도(눌렀을 때 살짝 들어감)를 써야 크리미해요.', time: 0 },
      { step: 2, description: '포크로 으깨되 식감을 살리려면 덩어리를 조금 남기세요.', time: 0 },
      { step: 3, description: '레몬즙 1작은술·올리브유 1/2큰술·소금·후추를 넣고 섞어주세요. 레몬즙은 변색 방지 역할도 해요.', time: 0 },
      { step: 4, description: '방울토마토 6개는 4등분해 남은 올리브유 1/2큰술과 소금 약간에 버무려주세요.', time: 0 },
      { step: 5, description: '호밀빵 2장을 토스터에 2분간 노릇하게 구워주세요.', time: 2 },
      { step: 6, description: '구운 빵 위에 아보카도 믹스를 듬뿍 올려 평평하게 펴주세요.', time: 0 },
      { step: 7, description: '그 위에 방울토마토를 가지런히 올려 완성하세요.', time: 0 },
    ],
  },

  '39': {
    id: '39', title: '폭신 계란 스크램블', image: IMG.scrambledEggs, category: '아침',
    time: 8, difficulty: '쉬움', calories: 220, rating: 4.8,
    servings: '1~2', tags: ['아침', '5분요리', '자취', '고단백', '베이직'],
    description: '호텔 조식에서 먹던 그 부드러움. 우유와 버터로 풍미를 살린 클래식 스크램블.\n약불로 천천히 저어야 돌덩이가 안 돼요!',
    ingredients: [
      { name: '달걀', amount: '3개', icon: '🥚' },
      { name: '우유', amount: '2큰술', icon: '🥛' },
      { name: '버터', amount: '1큰술', icon: '🧈' },
      { name: '소금', amount: '1/4작은술', icon: '🧂' },
      { name: '후추', amount: '약간', icon: '⚫' },
      { name: '쪽파', amount: '1대', icon: '🌿' },
    ],
    steps: [
      { step: 1, description: '볼에 달걀 3개를 깨서 넣고 60~70회 저어 흰자와 노른자가 완전히 합쳐지게 해주세요. 푹신함을 결정하는 단계예요.', time: 0 },
      { step: 2, description: '우유 2큰술·소금 1/4작은술·후추를 넣고 한 번 더 섞어주세요. 유지방이 촉촉함을 오래 유지시켜요.', time: 0 },
      { step: 3, description: '팬을 중불로 달군 뒤 불을 끄고 버터 1큰술을 녹여 고루 퍼뜨려주세요. 버터가 갈색이 되면 탄 맛이 나니 주의.', time: 0 },
      { step: 4, description: '약불로 바꾸고 계란물을 한 번에 부어주세요.', time: 0 },
      { step: 5, description: '실리콘 주걱으로 가장자리에서 안쪽으로 10초에 한 번씩 천천히 밀어주세요.', time: 2 },
      { step: 6, description: '70% 익어 수분이 살짝 남아있을 때 불을 끄세요. 잔열로 마저 익히면 퍽퍽하지 않아요.', time: 0 },
      { step: 7, description: '접시에 담고 송송 썬 쪽파와 후추를 뿌려 완성하세요.', time: 0 },
    ],
  },

  '41': {
    id: '41', title: '묵은지 김치볶음밥', image: IMG.kimchiFriedRice, category: '점심',
    time: 15, difficulty: '쉬움', calories: 540, rating: 4.9,
    servings: '1~2', tags: ['한식', '자취', '밥도둑', '간단', '매운맛'],
    description: '묵은지의 깊은 맛과 스팸 기름의 감칠맛이 만나는 국민 한 끼.\n계란프라이 반숙으로 올려야 완성이에요!',
    ingredients: [
      { name: '찬밥', amount: '2공기', icon: '🍚' },
      { name: '잘 익은 김치', amount: '1.5컵', icon: '🥬' },
      { name: '스팸', amount: '1/2캔', icon: '🥓' },
      { name: '대파', amount: '1대', icon: '🧅' },
      { name: '고추장', amount: '1작은술', icon: '🌶️' },
      { name: '참기름', amount: '1작은술', icon: '🫒' },
      { name: '달걀', amount: '2개', icon: '🥚' },
    ],
    steps: [
      { step: 1, description: '김치 1.5컵은 가위로 잘게 썰고, 스팸 1/2캔은 깍둑썰기, 대파 1대는 송송 썰어주세요. 찬밥을 써야 덜 질척거려요.', time: 0 },
      { step: 2, description: '달군 팬에 기름 없이 스팸을 넣어 기름이 투명해질 때까지 2분 볶아주세요. 감칠맛 오일을 뽑아내는 단계예요.', time: 2 },
      { step: 3, description: '대파의 흰 부분을 넣어 30초 파기름을 내주세요. 파기름이 향의 핵심!', time: 1 },
      { step: 4, description: '김치를 넣고 중불에서 3분 충분히 볶아주세요. 김치가 투명해지면 신맛이 날아가고 감칠맛이 올라옵니다.', time: 3 },
      { step: 5, description: '고추장 1작은술을 넣고 30초 볶아 양념을 구워주세요.', time: 1 },
      { step: 6, description: '찬밥 2공기를 넣고 주걱으로 눌러가며 3분 볶아주세요. 눌러 볶아야 누룽지 향이 살아요.', time: 3 },
      { step: 7, description: '대파 초록 부분을 넣고 30초 더 볶은 뒤 불을 끄고 참기름 1작은술을 둘러 섞어주세요.', time: 1 },
      { step: 8, description: '다른 팬에 계란프라이 2개를 반숙으로 만들어 볶음밥 위에 올려 완성하세요.', time: 2 },
    ],
  },

  '42': {
    id: '42', title: '매콤 제육덮밥', image: IMG.jeyukBowl, category: '점심',
    time: 25, difficulty: '쉬움', calories: 620, rating: 4.8,
    servings: '2~3', tags: ['한식', '매운맛', '밥도둑', '자취', '고단백'],
    description: '돼지고기 앞다리살을 매콤달콤 양념에 재워 볶아낸 밥도둑 끝판왕.\n양념 비율만 지키면 실패 없어요!',
    ingredients: [
      { name: '돼지고기 앞다리살', amount: '400g', icon: '🐖' },
      { name: '양파', amount: '1개', icon: '🧅' },
      { name: '대파', amount: '1대', icon: '🧅' },
      { name: '고추장', amount: '2큰술', icon: '🌶️' },
      { name: '고춧가루', amount: '1.5큰술', icon: '🌶️' },
      { name: '진간장', amount: '1.5큰술', icon: '🫗' },
      { name: '다진마늘', amount: '1큰술', icon: '🧄' },
      { name: '밥', amount: '2공기', icon: '🍚' },
    ],
    steps: [
      { step: 1, description: '돼지고기 400g은 키친타올로 핏물을 닦아주세요. 핏물이 남으면 잡내가 생깁니다.', time: 0 },
      { step: 2, description: '볼에 고추장 2큰술·고춧가루 1.5큰술·진간장 1.5큰술·다진마늘 1큰술·설탕 약간을 섞어 양념장을 만드세요.', time: 0 },
      { step: 3, description: '돼지고기에 양념장을 넣고 조물조물 버무려 15분 재워주세요. 오래 재울수록 속까지 양념이 배요.', time: 15 },
      { step: 4, description: '양파 1개는 채썰고, 대파 1대는 어슷썰어 준비하세요.', time: 0 },
      { step: 5, description: '달군 팬에 기름을 두르고 재운 고기를 센불에서 3분 볶아주세요. 센불로 겉을 먼저 잡아야 육즙이 안 빠져요.', time: 3 },
      { step: 6, description: '양파를 넣고 숨이 살짝 죽을 때까지 2분 더 볶아주세요.', time: 2 },
      { step: 7, description: '대파를 넣고 1분 볶아 향을 입혀주세요.', time: 1 },
      { step: 8, description: '따뜻한 밥 위에 제육볶음을 듬뿍 올려 완성하세요. 상추쌈으로 싸 먹어도 별미!', time: 0 },
    ],
  },

  '44': {
    id: '44', title: '부드러운 갈비찜', image: IMG.galbiJjim, category: '저녁',
    time: 100, difficulty: '보통', calories: 680, rating: 4.9,
    servings: '3~4', tags: ['한식', '명절', '특별한날', '고단백', '손님초대'],
    description: '명절 상차림의 주인공, 달콤 짭짤한 소갈비찜.\n배즙으로 재워 압력솥 없이도 푹 부드럽게 완성!',
    ingredients: [
      { name: '소갈비', amount: '1kg', icon: '🥩' },
      { name: '양파', amount: '1개', icon: '🧅' },
      { name: '당근', amount: '1개', icon: '🥕' },
      { name: '무', amount: '1/4개', icon: '🤍' },
      { name: '진간장', amount: '6큰술', icon: '🫗' },
      { name: '설탕', amount: '3큰술', icon: '🍬' },
      { name: '다진마늘', amount: '2큰술', icon: '🧄' },
      { name: '배즙', amount: '1/2컵', icon: '🍐' },
    ],
    steps: [
      { step: 1, description: '소갈비 1kg은 찬물에 1시간 이상 담가 핏물을 완전히 빼주세요. 중간에 물을 2번 갈아주면 잡내가 덜합니다.', time: 60 },
      { step: 2, description: '끓는 물에 10분 데쳐 기름기와 불순물을 제거한 뒤 찬물에 씻어주세요. 생략하면 국물이 탁해져요.', time: 10 },
      { step: 3, description: '양파 1개·당근 1개·무 1/4개는 큼직하게 썰어주세요.', time: 0 },
      { step: 4, description: '볼에 진간장 6큰술·설탕 3큰술·다진마늘 2큰술·배즙 1/2컵을 섞어 양념장을 만드세요. 배즙이 육질을 부드럽게 만들어요.', time: 0 },
      { step: 5, description: '냄비에 갈비·양념장·물 3컵을 넣고 센불로 끓이세요.', time: 5 },
      { step: 6, description: '끓기 시작하면 중약불로 줄여 뚜껑을 덮고 30분 푹 삶아주세요.', time: 30 },
      { step: 7, description: '양파·당근·무를 넣고 30분 더 조려주세요. 국물이 졸아들면 물을 조금씩 추가하세요.', time: 30 },
      { step: 8, description: '국물이 절반으로 졸아들면 불을 꺼 완성하세요. 접시에 담고 통깨를 뿌려주세요.', time: 0 },
    ],
  },

  '45': {
    id: '45', title: '기본 삼겹살 구이', image: IMG.samgyeopsal, category: '저녁',
    time: 20, difficulty: '쉬움', calories: 720, rating: 4.8,
    servings: '2~3', tags: ['한식', '회식', '가족식사', '쌈', '고단백'],
    description: '기본이자 최고. 소금 간과 불 조절만 지키면 실패 없어요.\n쌈채소·쌈장·마늘까지 풀세팅으로!',
    ingredients: [
      { name: '삼겹살(두께 1.5cm)', amount: '600g', icon: '🥓' },
      { name: '통마늘', amount: '10쪽', icon: '🧄' },
      { name: '상추', amount: '12장', icon: '🥬' },
      { name: '깻잎', amount: '12장', icon: '🍃' },
      { name: '청양고추', amount: '2개', icon: '🌶️' },
      { name: '쌈장', amount: '3큰술', icon: '🫘' },
      { name: '굵은 소금', amount: '1작은술', icon: '🧂' },
    ],
    steps: [
      { step: 1, description: '삼겹살 600g은 실온에 15분 두어 냉기를 빼주세요. 냉장고에서 바로 구우면 겉만 타고 속이 덜 익어요.', time: 15 },
      { step: 2, description: '상추·깻잎은 찬물에 씻어 물기를 털고, 청양고추는 어슷썰어 쌈 세팅을 준비하세요.', time: 0 },
      { step: 3, description: '팬이나 불판을 3분 이상 강하게 달궈주세요. 물 한 방울이 구슬처럼 굴러다니면 적당한 온도.', time: 3 },
      { step: 4, description: '기름 없이 삼겹살을 한 줄씩 올려 4분간 뒤집지 말고 구워주세요. 육즙이 빠져나와 고소한 껍질을 만듭니다.', time: 4 },
      { step: 5, description: '뒤집어 반대 면을 3분 더 구워 노릇하게 만들어주세요.', time: 3 },
      { step: 6, description: '통마늘 10쪽을 고기 옆에서 함께 구워 마늘향을 입혀주세요.', time: 2 },
      { step: 7, description: '다 익은 고기를 가위로 한입 크기로 자르고 굵은 소금을 살짝 뿌려주세요.', time: 0 },
      { step: 8, description: '상추·깻잎에 고기 한 점, 쌈장, 구운 마늘을 올려 쌈 싸 먹어요!', time: 0 },
    ],
  },

  '46': {
    id: '46', title: '집밥 닭볶음탕', image: IMG.dakBokkeumTang, category: '저녁',
    time: 55, difficulty: '보통', calories: 560, rating: 4.8,
    servings: '3~4', tags: ['한식', '매운맛', '가족식사', '국물요리', '밥도둑'],
    description: '칼칼한 국물에 감자와 닭이 푹 어우러진 주말 밥상의 정석.\n데치기·양념굽기만 지켜도 식당 퀄리티!',
    ingredients: [
      { name: '닭다리살', amount: '1kg', icon: '🍗' },
      { name: '감자', amount: '2개', icon: '🥔' },
      { name: '양파', amount: '1개', icon: '🧅' },
      { name: '대파', amount: '1대', icon: '🧅' },
      { name: '고춧가루', amount: '3큰술', icon: '🌶️' },
      { name: '고추장', amount: '2큰술', icon: '🌶️' },
      { name: '진간장', amount: '4큰술', icon: '🫗' },
      { name: '다진마늘', amount: '1.5큰술', icon: '🧄' },
    ],
    steps: [
      { step: 1, description: '닭 1kg은 끓는 물에 2분 데친 뒤 찬물에 씻어 잡내와 기름을 제거해주세요. 이 과정이 국물 맛을 좌우해요.', time: 2 },
      { step: 2, description: '감자 2개는 한입 크기로 썰고 모서리를 다듬어주세요. 모서리가 있으면 끓이다 부서져요.', time: 0 },
      { step: 3, description: '양파 1개는 큼직하게, 대파 1대는 어슷썰어 준비하세요.', time: 0 },
      { step: 4, description: '볼에 고춧가루 3큰술·고추장 2큰술·진간장 4큰술·다진마늘 1.5큰술·설탕 1큰술을 섞어 양념장을 만드세요.', time: 0 },
      { step: 5, description: '냄비에 닭과 양념장 절반을 넣고 1분간 버무려주세요. 양념 굽기로 감칠맛이 올라옵니다.', time: 1 },
      { step: 6, description: '물 4컵을 붓고 감자를 넣어 센불로 끓이세요.', time: 5 },
      { step: 7, description: '끓어오르면 중불로 줄여 20분 조려주세요. 거품은 걷어 국물을 맑게 유지하세요.', time: 20 },
      { step: 8, description: '남은 양념장과 양파를 넣고 10분 더 끓여주세요.', time: 10 },
      { step: 9, description: '대파를 넣고 2분 끓여 완성하세요.', time: 2 },
    ],
  },

  '47': {
    id: '47', title: '클래식 티라미수', image: IMG.tiramisu, category: '디저트',
    time: 30, difficulty: '보통', calories: 420, rating: 4.9,
    servings: '4~6', tags: ['양식', '디저트', '커피', '홈카페', '노오븐'],
    description: '에스프레소에 적신 레이디핑거와 마스카포네 크림이 켜켜이.\n오븐 없이 냉장고에서 4시간 굳히면 끝!',
    ingredients: [
      { name: '마스카포네 치즈', amount: '250g', icon: '🧀' },
      { name: '생크림', amount: '200ml', icon: '🥛' },
      { name: '설탕', amount: '60g', icon: '🍬' },
      { name: '달걀 노른자', amount: '3개', icon: '🥚' },
      { name: '레이디핑거', amount: '20개', icon: '🍪' },
      { name: '에스프레소', amount: '200ml', icon: '☕' },
      { name: '코코아파우더', amount: '3큰술', icon: '🍫' },
    ],
    steps: [
      { step: 1, description: '중탕 볼에 달걀 노른자 3개와 설탕 30g을 넣고 5분간 휘핑해 뽀얀 연노랑 리본이 생길 때까지 저어주세요.', time: 5 },
      { step: 2, description: '마스카포네 250g을 넣고 덩어리가 없어질 때까지 저속으로 섞어주세요.', time: 0 },
      { step: 3, description: '다른 볼에 차가운 생크림 200ml와 남은 설탕 30g을 넣고 뿔이 살짝 서는 70% 휘핑까지 올려주세요. 너무 단단하면 뻑뻑해져요.', time: 3 },
      { step: 4, description: '휘핑한 생크림을 마스카포네 반죽에 2~3회 나눠 주걱으로 폴딩하세요. 부피감을 살리는 게 핵심.', time: 0 },
      { step: 5, description: '식힌 에스프레소 200ml를 넓은 접시에 담아 적심용으로 준비하세요.', time: 0 },
      { step: 6, description: '레이디핑거를 1초씩 빠르게 담갔다 빼 사각 용기 바닥에 한 층 깔아주세요. 오래 담그면 물러져요.', time: 0 },
      { step: 7, description: '마스카포네 크림 절반을 올려 평평하게 펴주세요.', time: 0 },
      { step: 8, description: '같은 방법으로 레이디핑거 한 층을 더 깔고 남은 크림을 얹어 윗면을 매끈하게 다듬어주세요.', time: 0 },
      { step: 9, description: '랩을 씌워 냉장실에서 최소 4시간 굳혀주세요.', time: 240 },
      { step: 10, description: '자르기 직전에 코코아파우더 3큰술을 체에 내려 듬뿍 뿌려 완성하세요.', time: 0 },
    ],
  },

  '48': {
    id: '48', title: '진한 퍼지 브라우니', image: IMG.brownie, category: '디저트',
    time: 45, difficulty: '쉬움', calories: 380, rating: 4.8,
    servings: '6~8', tags: ['양식', '디저트', '초콜릿', '베이킹', '홈카페'],
    description: '겉은 파삭, 속은 진하게 촉촉한 퍼지 스타일 브라우니.\n다크초콜릿·코코아파우더 더블이 비법!',
    ingredients: [
      { name: '다크초콜릿(70%)', amount: '200g', icon: '🍫' },
      { name: '버터', amount: '120g', icon: '🧈' },
      { name: '설탕', amount: '160g', icon: '🍬' },
      { name: '달걀', amount: '3개', icon: '🥚' },
      { name: '박력분', amount: '80g', icon: '🌾' },
      { name: '코코아파우더', amount: '20g', icon: '🍫' },
      { name: '소금', amount: '1/4작은술', icon: '🧂' },
    ],
    steps: [
      { step: 1, description: '오븐을 180℃로 예열하고 20cm 사각틀에 유산지를 깔아주세요. 미리 예열해야 겉이 빠르게 굳어 파삭한 표면이 나와요.', time: 0 },
      { step: 2, description: '다크초콜릿 200g과 버터 120g을 중탕으로 녹여 한 김 식혀주세요. 전자레인지는 20초씩 끊어서 해야 타지 않아요.', time: 0 },
      { step: 3, description: '녹인 초콜릿에 설탕 160g을 넣고 거품기로 섞어주세요.', time: 0 },
      { step: 4, description: '달걀 3개를 하나씩 넣으며 매번 1분 휘핑해 공기를 듬뿍 포집하세요. 이 거품이 반짝이는 표면을 만듭니다.', time: 3 },
      { step: 5, description: '박력분 80g·코코아파우더 20g·소금 1/4작은술을 체에 쳐서 넣고 주걱으로 가르듯 섞어주세요. 글루텐이 많이 나오면 퍽퍽해져요.', time: 0 },
      { step: 6, description: '틀에 반죽을 붓고 윗면을 평평하게 정리한 뒤, 틀을 테이블에 2~3번 쳐서 큰 기포를 빼주세요.', time: 0 },
      { step: 7, description: '180℃에서 25분 구워주세요. 중앙을 꼬지로 찔렀을 때 촉촉한 부스러기가 묻어나야 정상.', time: 25 },
      { step: 8, description: '틀째 완전히 식힌 후 9등분으로 잘라 완성하세요. 뜨거울 때 자르면 부서져요.', time: 0 },
    ],
  },

  '50': {
    id: '50', title: '바삭 감자전', image: IMG.gamjaJeon, category: '간식',
    time: 25, difficulty: '쉬움', calories: 280, rating: 4.7,
    servings: '2~3', tags: ['한식', '비오는날', '집술안주', '간식', '쉬움'],
    description: '강판에 갈고 녹말을 살리는 게 비법. 겉은 바삭, 속은 쫀득한 감자전.\n간장 양념장에 찍어 막걸리와 함께!',
    ingredients: [
      { name: '감자', amount: '3개(약 400g)', icon: '🥔' },
      { name: '쪽파', amount: '3대', icon: '🌿' },
      { name: '청양고추', amount: '1개', icon: '🌶️' },
      { name: '소금', amount: '1/2작은술', icon: '🧂' },
      { name: '식용유', amount: '4큰술', icon: '🫒' },
      { name: '간장', amount: '2큰술', icon: '🫗' },
      { name: '식초', amount: '1큰술', icon: '🧴' },
    ],
    steps: [
      { step: 1, description: '감자 3개는 껍질을 벗기고 강판에 곱게 갈아주세요. 믹서로 갈면 물이 너무 많아 바삭함이 떨어져요.', time: 0 },
      { step: 2, description: '간 감자를 면보에 담아 물을 살짝 짜내되, 볼 바닥에 가라앉은 하얀 녹말은 절대 버리지 마세요. 이 녹말이 쫀득함의 비밀.', time: 3 },
      { step: 3, description: '짜낸 감자와 가라앉은 녹말을 다시 합쳐 섞어주세요.', time: 0 },
      { step: 4, description: '쪽파 3대와 청양고추 1개는 송송 썰어 감자에 넣고 소금 1/2작은술로 간하세요. 밀가루는 넣지 않아야 감자 본연의 맛이 살아요.', time: 0 },
      { step: 5, description: '팬에 식용유 2큰술을 넉넉히 두르고 중불로 달궈주세요. 기름이 충분해야 겉면이 튀김처럼 바삭해져요.', time: 1 },
      { step: 6, description: '반죽을 한 국자 떠 팬에 올리고 숟가락으로 얇게 펴주세요. 너무 두꺼우면 속이 설익어요.', time: 0 },
      { step: 7, description: '한 면을 3분 노릇하게 구운 뒤 뒤집어 2분 더 구워주세요.', time: 5 },
      { step: 8, description: '볼에 간장 2큰술·식초 1큰술·남은 기름 소량을 섞어 양념장을 만들어 곁들여 완성하세요.', time: 0 },
    ],
  },
};

let replaced = 0;
for (let i = 0; i < data.length; i++) {
  if (rewrites[data[i].id]) {
    data[i] = { ...rewrites[data[i].id], author: '요잘알', likes: 0, bookmarks: 0 };
    replaced++;
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4) + '\n', 'utf8');
console.log(`✅ 재작성: ${replaced}개 / 전체: ${data.length}개`);
