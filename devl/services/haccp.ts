import { authFetch } from './api';

const BASE_URL = 'https://yojalal.com';

/**
 * HACCP 인증 제품 검색 결과 항목 (백엔드 /api/haccp/search 응답의 item).
 * 원본 공공데이터 필드명 유지 — 변환은 UI 레이어에서.
 */
export type HaccpProduct = {
  prdlstReportNo: string; // 품목보고번호
  prdlstNm: string;       // 제품명
  manufacture: string;    // 제조원
  seller: string;         // 판매원
  prdkind: string;        // 식품유형
  prdkindState: string;   // 유형의 상태
  capacity: string;       // 용량
  rawmtrl: string;        // 원재료
  allergy: string;        // 알레르기
  nutrient: string;       // 영양성분
  barcode: string;
  imgurl1: string;        // 제품이미지
  imgurl2: string;        // 메타이미지
};

export type HaccpSearchResult = {
  items: HaccpProduct[];
  totalCount: number;
  pageNo: number;
  numOfRows: number;
  error?: string;
};

export type HaccpSearchOptions = {
  keyword?: string;       // 제품명
  reportNo?: string;      // 품목보고번호 (정확 조회)
  kind?: string;          // 유형명 (예: "가공치즈")
  manufacture?: string;   // 제조원
  allergy?: string;       // 알레르기 유발물질
  page?: number;
  size?: number;
};

/**
 * 식품명으로 HACCP 제품을 검색 (편의 함수).
 */
export async function searchHaccpProducts(
  keyword: string,
  page = 1,
  size = 20
): Promise<HaccpSearchResult> {
  return searchHaccp({ keyword, page, size });
}

/**
 * HACCP + 식약처 식품영양성분 DB 통합 검색.
 * 백엔드에서 두 API를 병렬 호출 + 이름 기준 중복 제거하여 반환.
 * HAACP(이미지 보유) 결과 우선 노출, 이후 식약처 생식재료 이름.
 */
export async function searchFoodAll(
  keyword: string,
  page = 1,
  size = 30
): Promise<HaccpSearchResult> {
  if (!keyword || !keyword.trim()) {
    return { items: [], totalCount: 0, pageNo: 1, numOfRows: 0 };
  }
  const params = new URLSearchParams({
    q: keyword.trim(),
    page: String(page),
    size: String(size),
  });
  try {
    const res = await authFetch(`${BASE_URL}/api/food/search?${params.toString()}`);
    if (!res.ok) {
      return { items: [], totalCount: 0, pageNo: page, numOfRows: 0, error: `HTTP ${res.status}` };
    }
    return (await res.json()) as HaccpSearchResult;
  } catch (e: any) {
    return { items: [], totalCount: 0, pageNo: page, numOfRows: 0, error: e?.message || 'network' };
  }
}

/**
 * 다중 필터로 HACCP 제품을 검색.
 * 하나 이상의 필터가 있어야 결과를 반환.
 */
export async function searchHaccp(opts: HaccpSearchOptions): Promise<HaccpSearchResult> {
  const params = new URLSearchParams();
  if (opts.keyword && opts.keyword.trim()) params.set('q', opts.keyword.trim());
  if (opts.reportNo && opts.reportNo.trim()) params.set('reportNo', opts.reportNo.trim());
  if (opts.kind && opts.kind.trim()) params.set('kind', opts.kind.trim());
  if (opts.manufacture && opts.manufacture.trim()) params.set('manufacture', opts.manufacture.trim());
  if (opts.allergy && opts.allergy.trim()) params.set('allergy', opts.allergy.trim());
  params.set('page', String(opts.page ?? 1));
  params.set('size', String(opts.size ?? 20));

  // 최소 하나의 필터가 있는지 확인
  const hasFilter = ['q', 'reportNo', 'kind', 'manufacture', 'allergy']
    .some(k => params.has(k));
  if (!hasFilter) {
    return { items: [], totalCount: 0, pageNo: 1, numOfRows: 0 };
  }

  const url = `${BASE_URL}/api/haccp/search?${params.toString()}`;
  try {
    const res = await authFetch(url);
    if (!res.ok) {
      return { items: [], totalCount: 0, pageNo: opts.page ?? 1, numOfRows: 0, error: `HTTP ${res.status}` };
    }
    return (await res.json()) as HaccpSearchResult;
  } catch (e: any) {
    return { items: [], totalCount: 0, pageNo: opts.page ?? 1, numOfRows: 0, error: e?.message || 'network' };
  }
}

/**
 * 품목보고번호로 정확히 1개 제품 조회.
 * (바코드 스캔 등으로 얻은 번호로 상세 정보를 가져올 때 사용)
 */
export async function getHaccpProductByReportNo(reportNo: string): Promise<HaccpProduct | null> {
  const r = await searchHaccp({ reportNo, size: 1 });
  return r.items[0] ?? null;
}

/**
 * 제품명에서 간단한 이모지를 추론 (HACCP API는 이모지를 주지 않음).
 * 완벽할 필요는 없고, 사용자가 편집 가능.
 */
export function guessIconFromProduct(p: { prdlstNm: string; prdkind?: string }): string {
  const text = `${p.prdlstNm} ${p.prdkind || ''}`.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/우유|milk/i, '🥛'],
    [/치즈|cheese/i, '🧀'],
    [/버터|butter/i, '🧈'],
    [/요거트|yogurt/i, '🥛'],
    [/계란|달걀|egg/i, '🥚'],
    [/빵|bread|베이글|크로와상/i, '🍞'],
    [/쌀|밥|rice/i, '🍚'],
    [/면|국수|라면|파스타|noodle/i, '🍜'],
    [/돼지|pork/i, '🥩'],
    [/소고기|beef|우육/i, '🥩'],
    [/닭|chicken/i, '🍗'],
    [/참치|tuna/i, '🐟'],
    [/연어|salmon/i, '🍣'],
    [/새우|shrimp/i, '🦐'],
    [/오징어|squid/i, '🦑'],
    [/햄|ham|베이컨|bacon|소시지|sausage/i, '🥓'],
    [/양파/i, '🧅'],
    [/대파|파\s/i, '🌿'],
    [/마늘/i, '🧄'],
    [/감자|potato/i, '🥔'],
    [/당근|carrot/i, '🥕'],
    [/배추|시금치|상추|lettuce|cabbage/i, '🥬'],
    [/버섯|mushroom/i, '🍄'],
    [/호박|pumpkin/i, '🎃'],
    [/고추|pepper/i, '🌶️'],
    [/브로콜리/i, '🥦'],
    [/토마토|tomato/i, '🍅'],
    [/오이|cucumber/i, '🥒'],
    [/피망|파프리카|bell/i, '🫑'],
    [/고추장|된장|쌈장/i, '🌶️'],
    [/간장|soy/i, '🫗'],
    [/참기름|들기름/i, '🫒'],
    [/식초|vinegar/i, '🧴'],
    [/설탕|sugar/i, '🍬'],
    [/소금|salt/i, '🧂'],
    [/김치/i, '🥬'],
    [/김\s|조미김/i, '🟢'],
    [/밀가루|flour/i, '🌾'],
    [/두부|tofu/i, '🧈'],
    [/떡/i, '🍡'],
    [/과자|스낵|쿠키|biscuit/i, '🍪'],
    [/초콜릿|chocolate/i, '🍫'],
    [/사탕|candy/i, '🍬'],
    [/아이스크림|ice\s?cream/i, '🍦'],
    [/커피|coffee/i, '☕'],
    [/차|tea/i, '🍵'],
    [/주스|juice/i, '🧃'],
    [/맥주|beer/i, '🍺'],
    [/와인|wine/i, '🍷'],
    [/물|water|생수/i, '💧'],
    [/통조림|can/i, '🥫'],
    [/냉동/i, '🧊'],
  ];
  for (const [re, emoji] of rules) {
    if (re.test(text)) return emoji;
  }
  return '🍱';
}

/**
 * 제품유형 상태 텍스트로 냉동/냉장 추정.
 * - "냉동" 포함 → freezer
 * - "실온"/"상온" → pantry (냉장 간주)
 * - 나머지 → fridge
 */
export function inferStorage(prdkindState: string | undefined): 'freezer' | 'fridge' {
  if (!prdkindState) return 'fridge';
  if (/냉동|frozen/i.test(prdkindState)) return 'freezer';
  return 'fridge';
}
