/**
 * 레시피 이미지 프롬프트에서 '조리 중인데 stove/heat 표현 없는' step들을
 * 수동 정의된 치환 규칙으로 일괄 수정.
 *
 * 각 치환은 원문 그대로 매칭 → 개선문으로 변경.
 * 매칭 실패 시 경고 출력.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'recipe-image-prompts.md');
let text = fs.readFileSync(FILE, 'utf8');

// [원문, 수정문] 쌍
const replacements = [
  // id 151 다이어트 볶음밥
  [
    'Close-up of diced vegetables being added to the pan of chicken, colorful mixture stir-frying with a wooden spatula.',
    'Close-up of diced vegetables being tossed into a hot non-stick pan sitting on the gas stove over medium-high heat, already containing shredded chicken, colorful mixture stir-frying with a wooden spatula, steam rising actively.'
  ],
  [
    'Top-down view of brown rice being added to the pan along with a drizzle of soy sauce, grains coating in the color of the vegetables.',
    'Top-down view of brown rice being scooped into the hot stir-fry pan on the gas stove over medium heat along with a drizzle of soy sauce, grains coating in the color of the vegetables, steam rising from the pan.'
  ],

  // id 145 라볶이
  [
    'Top-down view of ramen noodles, cabbage, and boiled eggs being added to the pot, everything nestling into the vivid red sauce.',
    'Top-down view of ramen noodles, cabbage, and boiled eggs being dropped into a shallow cooking pot sitting on the gas stove over medium flame, everything nestling into the actively bubbling vivid red sauce, steam rising.'
  ],

  // id 147 순대볶음
  [
    'Close-up of sundae slices and red marinade being added to the pan, every piece glossy in vibrant red sauce.',
    'Close-up of sundae slices and red marinade being added to a hot skillet on the gas stove over medium-high heat, sizzling intensely with every piece turning glossy in vibrant red sauce, steam and aromatic smoke rising.'
  ],

  // id 133 오므라이스
  [
    '3/4 view of white rice being added to the pan of vegetables with a generous squirt of red ketchup, rice turning orange-red as it fries.',
    '3/4 view of white rice being added to a hot non-stick pan on the gas stove over medium-high heat with the stir-fried vegetables and a generous squirt of red ketchup, rice turning orange-red as it fries, sizzling actively.'
  ],

  // id 139 짜장면
  [
    '3/4 view of cubed pork being added to the chunjang pan, meat turning dark brown as it absorbs the sauce.',
    '3/4 view of cubed pork being added to a hot pan of chunjang sauce sitting on the gas stove over medium heat, meat turning dark brown as it sizzles and absorbs the sauce, visible steam rising.'
  ],
  [
    'Top-down view of onion and potato being added to the pork-chunjang pan, vegetables starting to absorb the dark glossy sauce.',
    'Top-down view of onion and potato being dropped into the bubbling pork-chunjang pan on the gas stove over medium heat, vegetables starting to absorb the dark glossy sauce, steam rising actively.'
  ],
  [
    'Close-up of cabbage and zucchini being added to the pan, vegetables coating with dark chunjang sauce, colorful contrast.',
    'Close-up of cabbage and zucchini being added to the hot pan of chunjang on the gas stove over medium heat, vegetables coating with dark chunjang sauce, colorful contrast, steam rising.'
  ],
  [
    '3/4 view of water, sugar, and soy sauce being added to the pan, sauce simmering and reducing into a glossy rich black-brown gravy.',
    '3/4 view of water, sugar, and soy sauce being poured into the pan on the gas stove over medium heat, sauce actively simmering and reducing into a glossy rich black-brown gravy, bubbles rising across the surface.'
  ],

  // id 127 칼국수
  [
    '3/4 view of the dashi pouch being lifted out of the pot with tongs and potato chunks being added to the golden broth, simmering gently, steam rising.',
    '3/4 view of the dashi pouch being lifted out of a pot sitting on the gas stove over medium heat, and potato chunks being added to the golden broth, actively simmering with steam rising.'
  ],
  [
    'Close-up of fresh clams, zucchini, onion, and minced garlic being added to the simmering pot, clams beginning to open.',
    'Close-up of fresh clams, zucchini, onion, and minced garlic being added to the actively simmering pot on the gas stove over medium heat, clams beginning to open, steam rising vigorously.'
  ],

  // id 128 수제비
  [
    'Top-down view of zucchini and onion being added to the pot with floating dough pieces, colorful vegetables and white sujebi dumplings.',
    'Top-down view of zucchini and onion being dropped into a pot on the gas stove over medium heat with floating dough pieces, broth actively bubbling, colorful vegetables and white sujebi dumplings, steam rising.'
  ],

  // id 130 알리오 올리오 파스타
  [
    'Close-up of a ladle of starchy pasta water being added to the garlic oil pan, along with cooked spaghetti, emulsifying into a glossy sauce.',
    'Close-up of a ladle of starchy pasta water being poured into a hot garlic-oil skillet sitting on the gas stove over medium heat, along with cooked spaghetti, emulsifying and sizzling into a glossy sauce with steam rising.'
  ],

  // id 110 소불고기
  [
    'Close-up of onion, carrot, and mushrooms being added to the pan of cooked beef, vegetables softening, glossy marinade coating everything.',
    'Close-up of onion, carrot, and mushrooms being added to a hot pan of stir-fried beef on the gas stove over medium-high heat, vegetables softening and sizzling, glossy marinade coating everything, steam rising.'
  ],

  // id 111 돼지갈비찜
  [
    'Close-up of chunky potatoes, carrots, and onion being added to the simmering pot of pork ribs, vegetables nestling into rich brown broth.',
    'Close-up of chunky potatoes, carrots, and onion being lowered into a deep pot of actively simmering pork ribs on the gas stove over medium heat, vegetables nestling into the rich brown broth, steam rising vigorously.'
  ],

  // id 112 소갈비찜
  [
    'Close-up of chunky potato, carrot, and Korean radish being added to the pot of simmering short ribs, vegetables sinking into dark broth.',
    'Close-up of chunky potato, carrot, and Korean radish being dropped into a cast iron pot of actively simmering short ribs on the gas stove over medium heat, vegetables sinking into the dark glossy broth, steam rising.'
  ],
  [
    'Top-down view of red jujube dates being added to the reducing pot, tender ribs and vegetables glistening in dark glossy sauce.',
    'Top-down view of red jujube dates being scattered into the pot on the gas stove over low heat, sauce actively reducing with bubbles across the surface, tender ribs and vegetables glistening in dark glossy sauce.'
  ],

  // id 113 안동 찜닭
  [
    'Top-down view of chunky potato and carrot being added to the glossy dark brown simmering chicken pot, vegetables submerging into the vibrant sauce, steam rising.',
    'Top-down view of chunky potato and carrot being added to a wide pot of actively simmering chicken on the gas stove over medium heat, vegetables submerging into the glossy dark brown sauce, steam rising vigorously.'
  ],

  // id 116 닭갈비
  [
    'Close-up of cabbage, sweet potato, and rice cakes being added to the pan, vegetables softening and absorbing red sauce.',
    'Close-up of cabbage, sweet potato, and rice cakes being tossed into a hot wide pan of chicken on the gas stove over medium-high heat, vegetables sizzling and softening as they absorb the vivid red sauce, steam rising.'
  ],

  // id 117 카레라이스
  [
    '3/4 view of onion, potato, and carrot being added to the pot of pork, vegetables softening together.',
    '3/4 view of onion, potato, and carrot being added to a pot of stir-fried pork sitting on the gas stove over medium heat, vegetables softening together and sizzling lightly, steam rising.'
  ],
  [
    'Close-up of Japanese curry roux blocks being dropped into the simmering pot, roux dissolving into thick golden-brown curry sauce.',
    'Close-up of Japanese curry roux blocks being dropped into an actively simmering pot on the gas stove over low heat, roux dissolving into a thick golden-brown curry sauce with bubbles rising across the surface.'
  ],

  // id 121 찹스테이크
  [
    'Close-up of onion and bell pepper cubes being added to the pan of seared beef, vegetables softening with steam rising.',
    'Close-up of onion and bell pepper cubes being tossed into a hot cast iron skillet of seared beef on the gas stove over high heat, vegetables sizzling and softening with intense steam rising.'
  ],

  // id 122 마파두부
  [
    'Top-down view of spicy red doubanjiang sauce being added to the pork in the pan, vibrant red color blooming with intense aroma.',
    'Top-down view of spicy red doubanjiang sauce being added to stir-fried pork in a hot wok on the gas stove over medium-high heat, sauce actively sizzling as vibrant red color blooms with intense aroma and steam rising.'
  ],

  // id 95 미역국
  [
    'Close-up of dark green seaweed being added to the pot with beef, stir-frying together, sesame oil coating both, glossy dark green forming.',
    'Close-up of dark green seaweed being added to a hot pot with stir-frying beef on the gas stove over medium heat, ingredients sizzling together, sesame oil coating both, glossy dark green forming with steam rising.'
  ],

  // id 96 소고기 뭇국
  [
    'Close-up of white radish cubes being added to the pot of stir-fried beef, radish absorbing sesame oil and becoming glossy.',
    'Close-up of white radish cubes being added to a hot pot of stir-fried beef on the gas stove over medium heat, radish absorbing sesame oil and becoming glossy, sizzling lightly with steam rising.'
  ],

  // id 98 부대찌개
  [
    'Close-up of instant ramen noodles being added to the bubbling pot, noodles softening in the red broth.',
    'Close-up of instant ramen noodles being added to an actively bubbling pot on the gas stove over high heat, noodles softening in the vivid red broth, steam rising intensely.'
  ],

  // id 99 청국장
  [
    '3/4 view of kimchi and onion being added to the simmering broth pot, red color spreading through the liquid.',
    '3/4 view of kimchi and onion being added to an actively simmering broth pot on the gas stove over medium heat, red color spreading through the liquid, steam rising.'
  ],

  // id 101 차돌 된장찌개
  [
    '3/4 view of cubed tofu and a sprinkle of gochugaru being added to the pot, vivid red bloom spreading through the doenjang broth.',
    '3/4 view of cubed tofu and a sprinkle of gochugaru being added to a Korean earthenware pot (ttukbaegi) actively bubbling on the gas stove over medium heat, vivid red bloom spreading through the doenjang broth with steam rising.'
  ],

  // id 102 감자탕
  [
    'Top-down view of pork bones being added to the rich red broth pot, bones submerging, broth turning deeper red, long simmer beginning.',
    'Top-down view of pork bones being lowered into a large pot of rich red broth on the gas stove over medium heat, bones submerging as the broth actively simmers, turning deeper red with steam rising vigorously.'
  ],

  // id 105 떡만둣국
  [
    '3/4 view of plump dumplings being added to the pot of rice cakes, dumplings cooking in the clear broth, steam rising.',
    '3/4 view of plump dumplings being dropped into a pot of actively simmering rice cakes on the gas stove over medium heat, dumplings cooking in the clear broth with steam rising vigorously.'
  ],

  // id 107 시래기국
  [
    'Close-up of seasoned siraegi being added to the pot of stir-fried beef, dark greens coating with meat and oil.',
    'Close-up of seasoned siraegi being added to a hot pot of stir-fried beef on the gas stove over medium heat, dark greens sizzling and coating with meat and oil, steam rising.'
  ],

  // id 108 동태찌개
  [
    'Close-up of cubed tofu and sliced onion being added to the pot of fish stew, tofu floating among the fish in vivid red broth.',
    'Close-up of cubed tofu and sliced onion being added to a pot of actively simmering fish stew on the gas stove over medium heat, tofu floating among the fish in vivid red broth with steam rising.'
  ],

  // id 81 멸치볶음
  [
    'Close-up of soy sauce, sugar, and corn syrup being added to the pan of nuts and simmering together into a glossy caramelized glaze, fragrant',
    'Close-up of soy sauce, sugar, and corn syrup being poured into a hot pan of nuts on the gas stove over low heat, bubbling and actively simmering together into a glossy caramelized glaze, fragrant'
  ],

  // id 82 어묵볶음
  [
    'Close-up of triangular fish cakes being added to the pan with soy sauce, sugar, and corn syrup, glossy brown sauce coating everything, simmering together.',
    'Close-up of triangular fish cakes being added to a hot pan on the gas stove over medium heat with soy sauce, sugar, and corn syrup, glossy brown sauce actively simmering and coating everything, steam rising.'
  ],

  // id 83 감자볶음
  [
    '3/4 view of carrot, onion, and minced garlic being added to the pan of potatoes, vegetables tossing with the strips, vibrant orange and white',
    '3/4 view of carrot, onion, and minced garlic being added to a hot pan of stir-fried potatoes on the gas stove over medium-high heat, vegetables sizzling and tossing with the strips, vibrant orange and white'
  ],

  // id 86 메추리알 장조림
  [
    'Close-up of small green shishito peppers (kkwari gochu) being added to the pot, peppers floating among the dark-stained quail eggs.',
    'Close-up of small green shishito peppers (kkwari gochu) being added to an actively simmering pot on the gas stove over low heat, peppers floating among the dark-stained quail eggs with bubbles rising.'
  ],

  // id 87 소고기 장조림
  [
    'Close-up of shishito peppers being added to the pot of braised beef and eggs, final simmer, glossy brown liquid reducing.',
    'Close-up of shishito peppers being added to a pot of braised beef and eggs on the gas stove over low heat, final simmer with glossy brown liquid actively reducing and bubbles rising across the surface.'
  ],

  // id 94 마늘종볶음
  [
    'Close-up of soy sauce, sugar, and corn syrup being added to the pan of garlic scapes, braising liquid bubbling and coating each stalk glossy',
    'Close-up of soy sauce, sugar, and corn syrup being poured into a hot pan of garlic scapes on the gas stove over medium heat, braising liquid actively bubbling and coating each stalk glossy'
  ],

  // id 76 떡볶이
  [
    '3/4 view of rinsed rice cakes and triangle fish cakes being added to the bubbling red sauce in a wide pot, tteok sinking into the liquid, vibrant red coating forming.',
    '3/4 view of rinsed rice cakes and triangle fish cakes being added to an actively bubbling red sauce in a shallow tteokbokki pan on the gas stove over medium-high heat, tteok sinking into the liquid with vibrant red coating forming and steam rising.'
  ],
];

let applied = 0;
let failed = [];
for (const [before, after] of replacements) {
  if (text.includes(before)) {
    text = text.replace(before, after);
    applied++;
  } else {
    failed.push(before.slice(0, 80));
  }
}

fs.writeFileSync(FILE, text);
console.log(`✅ ${applied}/${replacements.length}건 수정 완료`);
if (failed.length) {
  console.log('\n⚠️ 매칭 실패:');
  for (const f of failed) console.log('  - ' + f + '...');
}
