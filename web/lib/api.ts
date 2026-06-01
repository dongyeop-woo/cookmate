/**
 * Cloud Run 백엔드 API 클라이언트.
 * 빌드 시점(Next.js SSR/SSG)에는 직접 호출, 런타임 클라이언트는 브라우저에서 호출.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE
  || 'https://yojalal.com';

export const STORE_URL = {
  ios: 'https://apps.apple.com/kr/app/%EC%9A%94%EC%9E%98%EC%95%8C/id6761661890',
  android: 'https://play.google.com/store/apps/details?id=com.dyw.cookmate',
};

export type Ingredient = { name: string; amount?: string; icon?: string };

export type Step = {
  step?: number;
  description: string;
  time?: number;
  imageUrl?: string;
  isAiImage?: boolean;
};

export type Recipe = {
  id: string;
  title: string;
  author?: string;
  time: number;
  difficulty?: string;
  calories?: number;
  servings?: string | number;
  rating?: number;
  likes?: number;
  reviewAvgRating?: number;
  reviewCount?: number;
  image?: string;
  category?: string;
  description?: string;
  ingredients?: Ingredient[];
  steps?: Step[];
  tags?: string[];
};

type FetchOpts = { next?: { revalidate?: number } };

async function get<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: opts.next ?? { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export async function fetchAllRecipes(): Promise<Recipe[]> {
  return get('/api/recipes');
}

export async function fetchRecipe(id: string): Promise<Recipe | null> {
  try {
    return await get(`/api/recipes/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function fetchRecipesByCategory(category: string): Promise<Recipe[]> {
  return get(`/api/recipes/category/${encodeURIComponent(category)}`);
}

/** 데일리/위클리 셔플용 시드 — 앱과 동일하게 일/주 단위로 결정적 셔플. */
function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function weekSeed(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return d.getFullYear() * 100 + Math.floor(days / 7);
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 앱의 home sections 와 동일 알고리즘으로 묶어서 반환. */
export async function fetchHomeSections() {
  let recipes: Recipe[] = [];
  try { recipes = await fetchAllRecipes(); } catch {}

  const best = [...recipes]
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, 10);

  const recommended = seededShuffle(recipes, daySeed()).slice(0, 8);

  const quick = [...recipes]
    .filter((r) => r.time <= 15)
    .sort((a, b) => a.time - b.time)
    .slice(0, 8);

  const snack = recipes
    .filter((r) => r.category === '간식' || r.category === '디저트')
    .slice(0, 8);

  const weekly = seededShuffle(recipes, weekSeed()).slice(0, 8);

  return { recipes, best, recommended, quick, snack, weekly };
}

export type CategoryDef = { name: string; icon: string };

/** 앱의 HOME_CATEGORIES 와 동일 순서. icon 은 /public/img/ 파일명. */
export const CATEGORIES: CategoryDef[] = [
  { name: '아침',   icon: 'breakfast.png' },
  { name: '점심',   icon: 'lunch.png' },
  { name: '저녁',   icon: 'dinner.png' },
  { name: '디저트', icon: 'dessert.png' },
  { name: '간식',   icon: 'snack.png' },
  { name: '음료',   icon: 'drink.png' },
  { name: '야식',   icon: 'midnight.png' },
  { name: '분식',   icon: 'street-food.png' },
  { name: '한식',   icon: 'korean.png' },
  { name: '양식',   icon: 'western.png' },
];

export function diffColor(d?: string): string {
  if (d === '쉬움') return '#1BAE74';
  if (d === '어려움') return '#E74C3C';
  return '#F5A623';
}

export function formatTime(t?: number): string {
  if (t == null) return '0';
  return Number.isInteger(t) ? `${t}` : t.toFixed(1);
}
