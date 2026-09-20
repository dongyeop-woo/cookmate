import { authFetch } from './api';

const BASE_URL = 'https://yojalal.com';

export interface AiRecommendItem {
  recipeId: string;
  title: string;
  reason: string;
  image?: string;
  category?: string;
}

export interface AiRecommendResult {
  recommendations: AiRecommendItem[];
  remainingFreeQuota: number | null; // null = 프리미엄
}

export interface AiQuota {
  remainingFreeQuota: number | null; // null = 프리미엄
  isPremium: boolean;
  dailyLimit: number;
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class OffTopicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OffTopicError';
  }
}

export async function getAiQuota(uid: string): Promise<AiQuota> {
  const res = await authFetch(`${BASE_URL}/api/ai/quota/${encodeURIComponent(uid)}`);
  if (!res.ok) {
    throw new Error(`쿼터 조회 실패 (status=${res.status})`);
  }
  return res.json();
}

export async function recommendRecipes(uid: string, query: string): Promise<AiRecommendResult> {
  const res = await authFetch(`${BASE_URL}/api/ai/recommend-recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, query }),
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new QuotaExceededError(body.message || '오늘의 무료 추천 한도를 모두 사용했어요.');
  }
  if (res.status === 400) {
    const body = await res.json().catch(() => ({}));
    if (body.error === 'OFF_TOPIC') {
      throw new OffTopicError(body.message || '요리·재료·분위기로 물어봐 주세요.');
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `AI 추천 실패 (status=${res.status})`);
  }
  return res.json();
}
