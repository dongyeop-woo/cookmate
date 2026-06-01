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
    // 기본 5분 캐시 — Cloudflare/Next 모두 활용. 작성/수정 빈도 낮은 레시피용.
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

export async function fetchPopularRecipes(limit = 12): Promise<Recipe[]> {
  const all = await fetchAllRecipes();
  return [...all]
    .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
    .slice(0, limit);
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
