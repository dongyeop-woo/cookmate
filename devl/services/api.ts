import type { Recipe, Category } from '../constants/recipes';
import type { CommunityRecipe } from '../constants/community';
import { authInstance } from '../firebase';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const BASE_URL = 'https://yojalal.com';

/**
 * 토큰 메모리 캐시 — Firebase JS SDK의 getIdToken()이 React Native에서
 * AsyncStorage 접근 때문에 느리다. 매 API 호출마다 호출하면 탭 전환 시 수십 번
 * 쌓여서 앱이 체감 상 느려진다. 50분 TTL로 메모리에 캐시.
 * (Firebase ID 토큰은 1시간 유효 — 50분 캐시하면 만료 직전 여유 10분)
 */
const TOKEN_TTL_MS = 50 * 60 * 1000;
let cachedToken: string | null = null;
let cachedTokenAt = 0;
let cachedTokenUid: string | null = null;

function invalidateToken() {
  cachedToken = null;
  cachedTokenAt = 0;
  cachedTokenUid = null;
}

async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const user = authInstance.currentUser;
    if (!user) {
      invalidateToken();
      return null;
    }
    // 유저 바뀌었으면 캐시 무효화
    if (cachedTokenUid !== user.uid) invalidateToken();

    const now = Date.now();
    if (!forceRefresh && cachedToken && now - cachedTokenAt < TOKEN_TTL_MS) {
      return cachedToken;
    }
    const fresh = await user.getIdToken(forceRefresh);
    cachedToken = fresh;
    cachedTokenAt = now;
    cachedTokenUid = user.uid;
    return fresh;
  } catch {
    return null;
  }
}

/**
 * 인증 만료/거부 시 호출되는 핸들러 — _layout.tsx에서 등록.
 * 등록 안 됐으면 no-op (테스트 환경 등).
 */
let onAuthFailureHandler: (() => void) | null = null;
export function setAuthFailureHandler(fn: (() => void) | null) {
  onAuthFailureHandler = fn;
}

/**
 * Firebase ID 토큰을 Authorization 헤더에 자동 첨부하는 fetch 래퍼.
 * 401 응답을 받으면 토큰을 강제 갱신하고 1회 재시도.
 * 재시도도 401/403이면 토큰이 진짜 만료/거부 — 자동 로그아웃 핸들러 호출.
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = await getIdToken();
  const existingHeaders = (init?.headers as Record<string, string> | undefined) || {};
  const headers: Record<string, string> = { ...existingHeaders };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(input, { ...init, headers });
  if (res.status !== 401 || !token) return res;

  // 토큰 만료 가능성 — 강제 갱신 후 1회 재시도
  invalidateToken();
  const freshToken = await getIdToken(true);
  if (!freshToken || freshToken === token) {
    onAuthFailureHandler?.();
    return res;
  }
  const retryHeaders = { ...headers, Authorization: `Bearer ${freshToken}` };
  const retryRes = await fetch(input, { ...init, headers: retryHeaders });
  // 갱신해도 401/403이면 진짜 인증 실패 — 자동 로그아웃 트리거
  if (retryRes.status === 401 || retryRes.status === 403) {
    onAuthFailureHandler?.();
  }
  return retryRes;
}

/** 로그아웃 시 토큰 캐시도 함께 무효화 — 외부에서 호출 */
export function clearTokenCache() {
  invalidateToken();
}

// ── In-memory cache ──
const cache = new Map<string, { data: any; ts: number }>();
// 5 minutes. 홈 탭 재방문 시 네트워크 호출 없이 즉시 렌더 → 렉 감소 + Firestore read 비용 절감.
// 레시피/카테고리는 분 단위로 바뀌지 않으므로 5분 캐시로 충분하며, 새 데이터 필요 시 invalidateCache()로 수동 무효화.
const CACHE_TTL = 5 * 60_000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

/** 태그 단위 캐시 무효화 — 연관된 키들을 한 번에 지운다. */
export function invalidateCacheTag(tag: 'recipes' | 'user' | 'community' | 'gifticons' | 'points') {
  const keys: string[] = [];
  switch (tag) {
    case 'recipes':
      keys.push('recipes');
      break;
    case 'community':
      keys.push('community', 'community_all');
      break;
    case 'user':
      // user 프로필은 명시적으로 캐시 안 되지만, 포인트 갱신 시에도 호출
      keys.push('user_profile');
      break;
    case 'gifticons':
      keys.push('gifticons');
      break;
    case 'points':
      keys.push('point_history', 'user_profile');
      break;
  }
  keys.forEach(k => cache.delete(k));
}

/** 로그아웃 시 호출 — 메모리 캐시 전체 초기화. */
export function clearAllCache() {
  cache.clear();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string> | undefined) || {}),
  };
  const res = await authFetch(`${BASE_URL}${path}`, {
    ...options,
    headers: mergedHeaders,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as unknown as T);
}

// ── Recipes ──

/**
 * 레시피 페이지네이션 — 다음 페이지 커서와 함께 반환.
 * limit 없이 호출하면 서버 기본 50개.
 */
export type RecipePage = { items: Recipe[]; nextCursor: string };
export async function fetchRecipesPage(limit = 50, cursor?: string): Promise<RecipePage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return request<RecipePage>(`/api/recipes?${params.toString()}`);
}

export async function fetchRecipes(): Promise<Recipe[]> {
  const cached = getCached<Recipe[]>('recipes');
  if (cached) return cached;
  const data = await request<Recipe[]>('/api/recipes');
  setCache('recipes', data);
  return data;
}

export async function fetchRecipeById(id: string): Promise<Recipe> {
  return request<Recipe>(`/api/recipes/${id}`);
}

/** 여러 레시피 ID를 한 번에 가져오기 (북마크/저장 목록용) — N+1 방지 */
export async function fetchRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (!ids.length) return [];
  const query = ids.slice(0, 50).map(encodeURIComponent).join(',');
  return request<Recipe[]>(`/api/recipes/batch?ids=${query}`);
}

export async function fetchRecipesByCategory(category: string): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes/category/${encodeURIComponent(category)}`);
}

export async function addRecipeComment(recipeId: string, uid: string, nickname: string, text: string, profileImage?: string): Promise<Recipe> {
  invalidateCache('recipes');
  return request<Recipe>(`/api/recipes/${encodeURIComponent(recipeId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ uid, nickname, text, profileImage }),
  });
}

export async function addCommentReply(recipeId: string, commentId: string, uid: string, reply: string): Promise<Recipe> {
  invalidateCache('recipes');
  const res = await authFetch(`${BASE_URL}/api/recipes/${encodeURIComponent(recipeId)}/comments/${encodeURIComponent(commentId)}/reply?uid=${encodeURIComponent(uid)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteCommentReply(recipeId: string, commentId: string, uid: string): Promise<Recipe> {
  invalidateCache('recipes');
  const res = await authFetch(`${BASE_URL}/api/recipes/${encodeURIComponent(recipeId)}/comments/${encodeURIComponent(commentId)}/reply?uid=${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteRecipeComment(recipeId: string, commentId: string): Promise<Recipe> {
  invalidateCache('recipes');
  invalidateCache('community');
  return request<Recipe>(`/api/recipes/${encodeURIComponent(recipeId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  invalidateCache('recipes');
  invalidateCache('community');
  await request(`/api/recipes/${encodeURIComponent(recipeId)}`, { method: 'DELETE' });
}

export async function updateRecipe(recipeId: string, data: Partial<Recipe>): Promise<Recipe> {
  invalidateCache('recipes');
  return request<Recipe>(`/api/recipes/${encodeURIComponent(recipeId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchTopRecipes(limit = 10): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes/top?limit=${limit}`);
}

export async function fetchRecipesByTag(tag: string): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes?tag=${encodeURIComponent(tag)}`);
}

export async function fetchQuickRecipes(maxMinutes = 15): Promise<Recipe[]> {
  return request<Recipe[]>(`/api/recipes/quick?maxMinutes=${maxMinutes}`);
}

export async function fetchCategories(): Promise<Category[]> {
  const cached = getCached<Category[]>('categories');
  if (cached) return cached;
  const data = await request<Category[]>('/api/recipes/categories');
  setCache('categories', data);
  return data;
}

// ── Community ──

export async function fetchCommunityRecipes(adminAll = false): Promise<CommunityRecipe[]> {
  const cacheKey = adminAll ? 'community_all' : 'community';
  const cached = getCached<CommunityRecipe[]>(cacheKey);
  if (cached) return cached;
  const data = await request<CommunityRecipe[]>('/api/community');
  setCache(cacheKey, data);
  // 관리자 전체 조회가 아니면 승인된 레시피만 반환
  return adminAll ? data : data.filter(r => !r.status || r.status === 'approved');
}

export async function fetchCommunityRecipeById(id: string): Promise<CommunityRecipe> {
  return request<CommunityRecipe>(`/api/community/${id}`);
}

export async function createCommunityRecipe(recipe: Omit<CommunityRecipe, 'id'>): Promise<CommunityRecipe> {
  invalidateCache('community');
  return request<CommunityRecipe>('/api/community', {
    method: 'POST',
    body: JSON.stringify(recipe),
  });
}

export async function updateCommunityRecipeApi(recipe: CommunityRecipe): Promise<CommunityRecipe> {
  invalidateCache('community');
  return request<CommunityRecipe>(`/api/community/${recipe.id}`, {
    method: 'PUT',
    body: JSON.stringify(recipe),
  });
}

export async function deleteCommunityRecipeApi(id: string): Promise<void> {
  invalidateCache('community');
  await request(`/api/community/${id}`, { method: 'DELETE' });
}

export async function updateCommunityStatus(id: string, status: 'approved' | 'rejected', rejectionReason?: string): Promise<void> {
  invalidateCache('community');
  const res = await authFetch(`${BASE_URL}/api/community/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...(rejectionReason && { rejectionReason }) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
}

export async function fetchMySubmissions(uid: string): Promise<CommunityRecipe[]> {
  return request<CommunityRecipe[]>(`/api/community/my/${encodeURIComponent(uid)}`);
}

export async function rateCommunityRecipe(id: string, userId: string, score: number): Promise<void> {
  await request(`/api/community/${id}/rating`, {
    method: 'POST',
    body: JSON.stringify({ userId, score }),
  });
  invalidateCache('community');
}

export async function likeCommunityRecipe(id: string): Promise<void> {
  await request(`/api/community/${id}/like`, { method: 'POST' });
  invalidateCache('community');
}

export async function unlikeCommunityRecipe(id: string): Promise<void> {
  await request(`/api/community/${id}/like`, { method: 'DELETE' });
  invalidateCache('community');
}

// ── Users ──

export type UserProfile = {
  uid: string;
  email: string;
  nickname: string;
  phone: string;
  profileImage: string;
  bio: string;
  gender: 'male' | 'female' | '';
  role: 'user' | 'admin';
  followers: string[];
  following: string[];
  likedRecipes: string[];
  recipeCount: number;
  totalLikes: number;
  points: number;
  deviceId?: string;
  kakaoId?: string;
  inviteCode?: string;
  invitedBy?: string;
  welcomeSignupRewarded?: boolean;
  welcomeAttendanceRewarded?: boolean;
  welcomeFirstRecipeRewarded?: boolean;
  createdAt?: string;
  updatedAt?: string;
  withdrawnAt?: string | null;
  rejoinedAt?: string | null;
  status?: string | null;
  termsVersion?: string;
  privacyVersion?: string;
  termsAgreedAt?: string;
  privacyAgreedAt?: string;
  alimtalkAgreedAt?: string;
  marketingAgreedAt?: string | null;
  birthYear?: number | null;
  blockedUids?: string[];
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
  premiumSource?: 'admin' | 'revenuecat' | null; // admin: 관리자 부여(영구), revenuecat: 실제 구매
};

export async function blockUser(uid: string, targetUid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/block/${encodeURIComponent(targetUid)}`, {
    method: 'POST',
  });
}

export async function unblockUser(uid: string, targetUid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/block/${encodeURIComponent(targetUid)}`, {
    method: 'DELETE',
  });
}

export async function createUser(user: Partial<UserProfile>): Promise<UserProfile> {
  return request<UserProfile>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

/**
 * 재가입 유저에게는 탈퇴 이전 생성된 개인 데이터를 숨긴다.
 * 서버에는 데이터가 보존되지만 (복구/감사 목적) 프론트에서는 rejoinedAt 이후 항목만 노출.
 * rejoinedAt이 없으면 (=탈퇴 이력 없음) 필터링하지 않는다.
 */
export function filterAfterRejoin<T extends { createdAt?: string | null }>(
  items: T[],
  rejoinedAt?: string | null,
): T[] {
  if (!rejoinedAt) return items;
  const cutoff = new Date(rejoinedAt).getTime();
  if (isNaN(cutoff)) return items;
  return items.filter((item) => {
    if (!item.createdAt) return false;
    const t = new Date(item.createdAt).getTime();
    return !isNaN(t) && t > cutoff;
  });
}

export async function fetchUser(uid: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/users/${encodeURIComponent(uid)}`);
  } catch {
    return null;
  }
}

export async function updateUser(uid: string, data: Partial<UserProfile>): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${encodeURIComponent(uid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function followUser(uid: string, targetUid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/follow/${encodeURIComponent(targetUid)}`, { method: 'POST' });
}

export async function unfollowUser(uid: string, targetUid: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/follow/${encodeURIComponent(targetUid)}`, { method: 'DELETE' });
}

export async function likeRecipeUser(uid: string, recipeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/like/${encodeURIComponent(recipeId)}`, { method: 'POST' });
  // 5분 캐시 때문에 좋아요 카운트가 즉시 갱신되지 않는 문제 방지 — 본인 액션은 항상 즉시 반영
  invalidateCache('recipes');
  invalidateCache('community');
}

export async function unlikeRecipeUser(uid: string, recipeId: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/like/${encodeURIComponent(recipeId)}`, { method: 'DELETE' });
  invalidateCache('recipes');
  invalidateCache('community');
}

export async function fetchUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/users/email/${encodeURIComponent(email)}`);
  } catch {
    return null;
  }
}

export async function fetchUserByPhone(phone: string): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>(`/api/users/phone/${encodeURIComponent(phone)}`);
  } catch {
    return null;
  }
}

export async function fetchTopUsers(limit = 20): Promise<UserProfile[]> {
  return request<UserProfile[]>(`/api/users/top?limit=${limit}`);
}

/**
 * 회원 탈퇴. purgeContent=true면 본인이 작성한 레시피/리뷰/댓글도 완전 삭제.
 * false(기본)면 익명화만 하고 콘텐츠는 유지됨.
 */
export async function deleteUserAccount(uid: string, purgeContent = false): Promise<void> {
  const q = purgeContent ? '?purgeContent=true' : '';
  await request(`/api/users/${encodeURIComponent(uid)}${q}`, { method: 'DELETE' });
}

export async function checkNicknameAvailable(nickname: string): Promise<boolean> {
  const res = await request<{ available: boolean }>(`/api/users/nickname-check?nickname=${encodeURIComponent(nickname)}`);
  return res.available;
}

// ── Admin Stats ──

export type DauDay = { date: string; count: number };
export type RetentionBucket = { cohortDate: string; cohortSize: number; retained: number; rate: number };
export type RetentionResult = { d1: RetentionBucket; d7: RetentionBucket; d30: RetentionBucket };
export type TimeToFirstRecipe = {
  totalUsers: number;
  withFirstRecipe: number;
  neverWrote: number;
  medianDays: number;
  avgDays: number;
  buckets: Record<string, number>;
};
export type ReasonCount = { reason: string; count: number };
export type ReviewLengthStats = { total: number; avgLength: number; buckets: Record<string, number> };
export type GifticonHeatmap = { total: number; heatmap: number[][] };
export type CustomIngredient = { name: string; count: number; firstSeenAt: string; lastSeenAt: string };
export type FailedSearch = { query: string; count: number; lastSeenAt: string };
export type CookingDropoffStep = { step: number; enter: number; complete: number; dropoffRate: number };
export type CookingDropoff = { recipeId: string; recipeTitle: string; steps: CookingDropoffStep[] };

export async function fetchDau(date?: string): Promise<DauDay> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<DauDay>(`/api/admin/stats/dau${q}`);
}
export async function fetchDauSeries(days = 7): Promise<DauDay[]> {
  return request<DauDay[]>(`/api/admin/stats/dau/series?days=${days}`);
}
export async function fetchRetention(): Promise<RetentionResult> {
  return request<RetentionResult>('/api/admin/stats/retention');
}
export async function fetchTimeToFirstRecipe(): Promise<TimeToFirstRecipe> {
  return request<TimeToFirstRecipe>('/api/admin/stats/time-to-first-recipe');
}
export async function fetchReportsByReason(): Promise<ReasonCount[]> {
  return request<ReasonCount[]>('/api/admin/stats/reports-by-reason');
}
export async function fetchReviewLength(): Promise<ReviewLengthStats> {
  return request<ReviewLengthStats>('/api/admin/stats/review-length');
}
export async function fetchRefundReasons(): Promise<ReasonCount[]> {
  return request<ReasonCount[]>('/api/admin/stats/refund-reasons');
}
export async function fetchGifticonHeatmap(): Promise<GifticonHeatmap> {
  return request<GifticonHeatmap>('/api/admin/stats/gifticon-heatmap');
}
export async function fetchCustomIngredients(): Promise<CustomIngredient[]> {
  return request<CustomIngredient[]>('/api/admin/stats/custom-ingredients');
}
export async function fetchFailedSearches(): Promise<FailedSearch[]> {
  return request<FailedSearch[]>('/api/admin/stats/failed-searches');
}
export async function fetchCookingDropoff(): Promise<CookingDropoff[]> {
  return request<CookingDropoff[]>('/api/admin/stats/cooking-dropoff');
}

// ── Analytics Tracking (event logging) ──

/** 검색 결과 0개 쿼리 기록. Fire-and-forget — 응답 기다리지 않음. */
export function trackFailedSearch(query: string, source: 'recipe' | 'ingredient' | 'community'): void {
  if (!query || !query.trim()) return;
  authFetch(`${BASE_URL}/api/analytics/failed-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.trim(), source }),
  }).catch(() => {});
}

/** 요리모드 단계 진입/완료 이벤트 기록. Fire-and-forget. */
export function trackCookingStep(recipeId: string, recipeTitle: string, step: number, type: 'enter' | 'complete'): void {
  if (!recipeId) return;
  authFetch(`${BASE_URL}/api/analytics/cooking-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId, recipeTitle, step, type }),
  }).catch(() => {});
}

// ── Reviews (후기) ──

export type Review = {
  id: string;
  recipeId: string;
  uid: string;
  authorNickname?: string;
  authorProfileImage?: string;
  photoUrl: string;
  content: string;
  rating?: number;
  pointAwarded: number;
  pointDenyReason?: 'OWN_RECIPE' | 'ALREADY_REVIEWED' | 'PAST_EARN' | 'DAILY_LIMIT' | null;
  createdAt: string;
  reply?: string;
  replyAuthorNickname?: string;
  replyCreatedAt?: string;
};

export async function fetchReviewsByRecipe(recipeId: string): Promise<Review[]> {
  return request<Review[]>(`/api/reviews/recipe/${encodeURIComponent(recipeId)}`);
}

export async function fetchReviewsByUser(uid: string): Promise<Review[]> {
  return request<Review[]>(`/api/reviews/user/${encodeURIComponent(uid)}`);
}

export async function createReview(input: {
  recipeId: string;
  uid: string;
  authorNickname?: string;
  authorProfileImage?: string;
  photoUrl?: string;
  content: string;
  rating?: number;
}): Promise<Review> {
  const res = await authFetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  invalidateCache('recipes');
  invalidateCache('community');
  return res.json();
}

export async function updateReview(id: string, uid: string, input: { content?: string; photoUrl?: string; rating?: number }): Promise<Review> {
  const res = await authFetch(`${BASE_URL}/api/reviews/${encodeURIComponent(id)}?uid=${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  invalidateCache('recipes');
  invalidateCache('community');
  return res.json();
}

export async function deleteReview(id: string): Promise<void> {
  const res = await authFetch(`${BASE_URL}/api/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  invalidateCache('recipes');
  invalidateCache('community');
}

export async function addReviewReply(reviewId: string, uid: string, content: string): Promise<Review> {
  const res = await authFetch(`${BASE_URL}/api/reviews/${encodeURIComponent(reviewId)}/reply?uid=${encodeURIComponent(uid)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function deleteReviewReply(reviewId: string, uid: string): Promise<Review> {
  const res = await authFetch(`${BASE_URL}/api/reviews/${encodeURIComponent(reviewId)}/reply?uid=${encodeURIComponent(uid)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ── User Gifticons ──
export type UserGifticon = {
  id: string;
  uid: string;
  trId: string;
  goodsCode: string;
  name: string;
  brand: string;
  brandIcon?: string;
  couponImageUrl?: string;
  pinNo?: string;
  validPeriod?: string;
  pointCost: number;
  used: boolean;
  usedAt?: string;
  refunded?: boolean;
  refundedAt?: string;
  refundPending?: boolean;
  refundRequestId?: string;
  createdAt: string;
  grantedBy?: string;
  grantReason?: string;
};

export type RefundRequest = {
  id: string;
  uid: string;
  nickname?: string;
  gifticonId: string;
  trId: string;
  gifticonName: string;
  brand: string;
  pointCost: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
};

export async function requestRefund(uid: string, gifticonId: string, reason: string): Promise<RefundRequest> {
  const res = await authFetch(`${BASE_URL}/api/refund-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, gifticonId, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '환불 요청 실패' }));
    throw new Error(err.error || '환불 요청 실패');
  }
  return res.json();
}

export async function fetchRefundRequests(status?: string): Promise<RefundRequest[]> {
  const q = status ? `?status=${status}` : '';
  return request<RefundRequest[]>(`/api/refund-requests${q}`);
}

export async function fetchMyRefundRequests(uid: string): Promise<RefundRequest[]> {
  return request<RefundRequest[]>(`/api/refund-requests/user?uid=${encodeURIComponent(uid)}`);
}

export async function checkRefundCouponStatus(id: string): Promise<{ pinStatusCd?: string; pinStatusNm?: string; cancelable?: boolean; validPrdEndDt?: string; error?: string }> {
  return request(`/api/refund-requests/${encodeURIComponent(id)}/coupon-status`);
}

export async function approveRefund(id: string, adminNote?: string): Promise<void> {
  await request(`/api/refund-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminNote }),
  });
}

export async function rejectRefund(id: string, adminNote?: string): Promise<void> {
  await request(`/api/refund-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ adminNote }),
  });
}

export async function fetchUserGifticons(uid: string): Promise<UserGifticon[]> {
  try {
    const res = await authFetch(`${BASE_URL}/api/user-gifticons?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function markGifticonUsed(id: string, uid: string): Promise<void> {
  await authFetch(`${BASE_URL}/api/user-gifticons/${encodeURIComponent(id)}/used?uid=${encodeURIComponent(uid)}`, {
    method: 'POST',
  });
}

// 관리자 전용: 특정 유저에게 기프티콘 직접 발급 (이벤트 보상 등)
export async function adminGrantGifticon(payload: {
  uid: string;
  name: string;
  brand?: string;
  brandIcon?: string;
  couponImageUrl?: string;
  pinNo: string;
  validPeriod?: string;
  trId?: string;
  goodsCode?: string;
  grantReason?: string;
}): Promise<UserGifticon> {
  const res = await authFetch(`${BASE_URL}/api/user-gifticons/admin/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '기프티콘 발급에 실패했습니다.');
  }
  return await res.json();
}

// ── Cooking History ──
export async function markRecipeCooked(uid: string, recipeId: string): Promise<void> {
  try {
    await authFetch(`${BASE_URL}/api/cooking-history/complete?uid=${encodeURIComponent(uid)}&recipeId=${encodeURIComponent(recipeId)}`, {
      method: 'POST',
    });
  } catch {}
}

export async function checkRecipeCooked(uid: string, recipeId: string): Promise<boolean> {
  try {
    const res = await authFetch(`${BASE_URL}/api/cooking-history/check?uid=${encodeURIComponent(uid)}&recipeId=${encodeURIComponent(recipeId)}`);
    if (!res.ok) return false;
    const json = await res.json();
    return !!json.cooked;
  } catch {
    return false;
  }
}

export async function getCookingRecord(uid: string, recipeId: string): Promise<{ cooked: boolean; cookedAt?: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/api/cooking-history/check?uid=${encodeURIComponent(uid)}&recipeId=${encodeURIComponent(recipeId)}`);
    if (!res.ok) return { cooked: false };
    return await res.json();
  } catch {
    return { cooked: false };
  }
}

// 확장자 → MIME. 움짤(gif)과 영상 제외, 정적 이미지 포맷은 모두 전달.
const IMAGE_EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  avif: 'image/avif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function resolveImageMime(imageUri: string): { ext: string; mimeType: string } {
  const rawExt = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
  const mime = IMAGE_EXT_TO_MIME[rawExt];
  if (mime) return { ext: rawExt, mimeType: mime };
  return { ext: 'jpg', mimeType: 'image/jpeg' };
}

// 업로드 전 이미지 전처리: 가로 1920px 초과 시 다운스케일 + JPEG 0.8 압축.
// 서버 multipart 한도(10MB) 초과로 인한 500 에러 방지. 실패 시 원본 URI 반환.
async function prepareImageForUpload(
  imageUri: string,
  maxWidth = 1920,
  compress = 0.8,
): Promise<string> {
  try {
    const probe = await ImageManipulator.manipulate(imageUri).renderAsync();
    if (probe.width <= maxWidth) {
      const saved = await probe.saveAsync({ compress, format: SaveFormat.JPEG });
      return saved.uri;
    }
    const ctx = ImageManipulator.manipulate(imageUri);
    ctx.resize({ width: maxWidth });
    const image = await ctx.renderAsync();
    const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG });
    return saved.uri;
  } catch (e) {
    console.warn('[prepareImageForUpload] failed, using original', e);
    return imageUri;
  }
}

export async function uploadRecipeImage(uid: string, imageUri: string): Promise<string> {
  const processedUri = await prepareImageForUpload(imageUri);
  const formData = new FormData();
  const { ext, mimeType } = resolveImageMime(processedUri);
  formData.append('uid', uid);
  formData.append('file', {
    uri: processedUri,
    name: `recipe.${ext}`,
    type: mimeType,
  } as any);
  const res = await authFetch(`${BASE_URL}/api/upload/recipe-image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch {}
    console.warn('[uploadRecipeImage] failed', res.status, detail);
    throw new Error(`이미지 업로드 실패 (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const json = await res.json();
  return json.url;
}

export async function uploadReviewImage(uid: string, imageUri: string): Promise<string> {
  const processedUri = await prepareImageForUpload(imageUri);
  const formData = new FormData();
  const { ext, mimeType } = resolveImageMime(processedUri);
  formData.append('uid', uid);
  formData.append('file', {
    uri: processedUri,
    name: `review.${ext}`,
    type: mimeType,
  } as any);
  const res = await authFetch(`${BASE_URL}/api/upload/review-image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch {}
    throw new Error(`이미지 업로드 실패 (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const json = await res.json();
  return json.url;
}

// ── Inquiries (문의하기) ──

export type Inquiry = {
  id: string;
  uid: string;
  authorNickname?: string;
  authorEmail?: string;
  category: string;
  title: string;
  content: string;
  images?: string[];
  status: 'pending' | 'answered' | 'closed';
  adminReply?: string;
  repliedBy?: string;
  repliedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export async function createInquiry(input: {
  uid: string;
  authorNickname?: string;
  authorEmail?: string;
  category: string;
  title: string;
  content: string;
  images?: string[];
}): Promise<Inquiry> {
  const res = await authFetch(`${BASE_URL}/api/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchMyInquiries(uid: string): Promise<Inquiry[]> {
  return request<Inquiry[]>(`/api/inquiries/user/${encodeURIComponent(uid)}`);
}

export async function fetchInquiryById(id: string): Promise<Inquiry> {
  return request<Inquiry>(`/api/inquiries/${encodeURIComponent(id)}`);
}

export async function fetchAllInquiries(status?: 'pending' | 'answered' | 'closed' | 'all'): Promise<Inquiry[]> {
  const qs = status ? `?status=${status}` : '';
  return request<Inquiry[]>(`/api/inquiries${qs}`);
}

export async function replyInquiry(id: string, adminUid: string, reply: string): Promise<Inquiry> {
  const res = await authFetch(`${BASE_URL}/api/inquiries/${encodeURIComponent(id)}/reply?adminUid=${encodeURIComponent(adminUid)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function updateInquiryStatus(id: string, status: 'pending' | 'answered' | 'closed'): Promise<void> {
  await authFetch(`${BASE_URL}/api/inquiries/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

// ── Attendance (출석체크) ──

export type AttendanceStatus = {
  attendedToday: boolean;
  currentStreak: number;
  nextStreak: number;
  expectedBase: number;
  expectedBonus: number;
};

export type AttendanceCheckResult = {
  id: string;
  uid: string;
  date: string;
  streak: number;
  awardedPoints: number;
  bonusPoints: number;
  createdAt: string;
};

export async function fetchAttendanceStatus(uid: string): Promise<AttendanceStatus> {
  return request<AttendanceStatus>(`/api/attendance/status?uid=${encodeURIComponent(uid)}`);
}

export async function checkAttendance(uid: string): Promise<AttendanceCheckResult> {
  const res = await authFetch(`${BASE_URL}/api/attendance/check?uid=${encodeURIComponent(uid)}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

// ===== 일일 도전과제 =====
// 과제 완료 자체엔 포인트가 없다(어뷰징 방지). 하루에 하나라도 완료하면
// 연속(streak)이 이어지고 7일마다 보너스가 지급된다.

export type ChallengeTask = {
  id: 'listen' | 'like' | 'review';
  title: string;
  sub: string;
  completed: boolean;
};

export type ChallengeToday = {
  date: string;
  tasks: ChallengeTask[];
  completedCount: number;
  totalCount: number;
  dayCompleted: boolean;
  currentStreak: number;
  /** 다음 보너스까지 남은 일수. 0이면 오늘 완료 시 보너스 지급 */
  nextBonusIn: number;
};

export type ChallengeCompleteResult = ChallengeToday & {
  /** 오늘 첫 완료였는지 — true 일 때만 연속이 진행됨 */
  firstOfDay: boolean;
  awardedBonus: number;
};

export async function fetchTodayChallenges(uid: string): Promise<ChallengeToday> {
  return request<ChallengeToday>(`/api/challenges/today?uid=${encodeURIComponent(uid)}`);
}

/**
 * 과제 완료 보고. 백엔드가 멱등 처리하므로 중복 호출은 안전하다.
 * 화면 흐름을 막으면 안 되는 부수 동작이라 실패해도 throw 하지 않는다.
 */
export async function completeChallenge(
  uid: string,
  taskId: ChallengeTask['id'],
): Promise<ChallengeCompleteResult | null> {
  try {
    const res = await authFetch(
      `${BASE_URL}/api/challenges/complete?uid=${encodeURIComponent(uid)}&taskId=${encodeURIComponent(taskId)}`,
      { method: 'POST' },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('도전과제 완료 보고 실패:', e);
    return null;
  }
}

export async function uploadProfileImage(uid: string, imageUri: string): Promise<string> {
  const processedUri = await prepareImageForUpload(imageUri);
  const formData = new FormData();
  const { ext, mimeType } = resolveImageMime(processedUri);
  formData.append('uid', uid);
  formData.append('file', {
    uri: processedUri,
    name: `profile.${ext}`,
    type: mimeType,
  } as any);
  const res = await authFetch(`${BASE_URL}/api/upload/profile-image`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch {}
    throw new Error(`이미지 업로드 실패 (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const json = await res.json();
  return json.url;
}

// SMS 인증
// 소셜 로그인
export async function exchangeKakaoToken(accessToken: string): Promise<{
  success: boolean;
  firebaseToken: string;
  kakaoId: string;
  email: string;
  nickname: string;
  message?: string;
}> {
  return request('/api/auth/kakao', {
    method: 'POST',
    body: JSON.stringify({ accessToken }),
  });
}

// 카카오 채널 보상 상태 확인
export async function checkKakaoChannelStatus(uid: string): Promise<{ rewarded: boolean }> {
  return request(`/api/auth/kakao-channel-status?uid=${encodeURIComponent(uid)}`);
}

// 카카오 채널 친구 추가 보상
export async function claimKakaoChannelReward(uid: string, kakaoId?: string): Promise<{ success: boolean; message: string }> {
  return request('/api/auth/kakao-channel-reward', {
    method: 'POST',
    body: JSON.stringify({ uid, kakaoId }),
  });
}

// 푸시 알림
export async function updateLastActive(uid: string): Promise<void> {
  try {
    await request(`/api/users/${encodeURIComponent(uid)}/active`, { method: 'PUT' });
  } catch {}
}

export type ServerNotification = {
  id: string;
  uid: string;
  title: string;
  body: string;
  category: string;
  route?: string;
  imageUrl?: string;
  read: boolean;
  createdAt: string;
};

export async function fetchServerNotifications(uid: string): Promise<ServerNotification[]> {
  return request<ServerNotification[]>(`/api/notifications?uid=${encodeURIComponent(uid)}`);
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await request(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PUT' });
  } catch {}
}

export async function markAllNotificationsReadServer(uid: string): Promise<void> {
  try {
    await request(`/api/notifications/read-all`, { method: 'PUT', body: JSON.stringify({ uid }) });
  } catch {}
}

/** 안 읽은 알림 카운트 — 홈 배지용 (단건 조회, 가벼움) */
export async function fetchUnreadNotificationCount(uid: string): Promise<number> {
  try {
    const res = await request<{ count: number }>(`/api/notifications/unread-count?uid=${encodeURIComponent(uid)}`);
    return res.count ?? 0;
  } catch {
    return 0;
  }
}

export async function deleteNotification(id: string): Promise<void> {
  try {
    await request(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch {}
}

export async function deleteAllNotifications(uid: string): Promise<void> {
  try {
    await request(`/api/notifications?uid=${encodeURIComponent(uid)}`, { method: 'DELETE' });
  } catch {}
}

export async function updatePushToken(uid: string, pushToken: string): Promise<void> {
  await request(`/api/users/${encodeURIComponent(uid)}/push-token`, {
    method: 'PUT',
    body: JSON.stringify({ pushToken }),
  });
}

// ── Admin ──

export type Report = {
  id: string;
  reporterUid: string;
  reporterNickname?: string;
  targetType: 'recipe' | 'community' | 'user' | 'comment';
  targetId: string;
  targetTitle?: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
};

export async function fetchAllUsers(): Promise<UserProfile[]> {
  return request<UserProfile[]>('/api/users/top?limit=1000');
}

export async function setUserRole(uid: string, role: 'user' | 'admin'): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${encodeURIComponent(uid)}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export async function setUserPremium(uid: string, premium: boolean): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${encodeURIComponent(uid)}/premium`, {
    method: 'PUT',
    body: JSON.stringify({ premium }),
  });
}

/**
 * 본인 프리미엄 상태 동기화 — RevenueCat 구매/복원 후 호출.
 * 백엔드는 본인 인증(requireSelf) 후 Firestore의 isPremium 필드를 갱신.
 */
export async function syncPremium(uid: string, isPremium: boolean, expiresAt: string | null): Promise<UserProfile> {
  return request<UserProfile>(`/api/users/${encodeURIComponent(uid)}/premium-self`, {
    method: 'POST',
    body: JSON.stringify({ isPremium, expiresAt }),
  });
}

export async function createReport(data: {
  reporterUid: string;
  reporterNickname?: string;
  targetType: Report['targetType'];
  targetId: string;
  targetTitle?: string;
  reason: string;
}): Promise<void> {
  await request('/api/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchReports(): Promise<Report[]> {
  return request<Report[]>('/api/admin/reports');
}

export async function resolveReport(reportId: string, action: 'resolved' | 'dismissed'): Promise<void> {
  await request(`/api/admin/reports/${reportId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: action }),
  });
}

// 어드민 — 기존 Storage 이미지를 max 1200px로 일괄 리사이즈 (URL 변경 없이 덮어쓰기).
// 한 번 호출에 limit 개씩 처리 후 nextPageToken 반환. 클라이언트가 nextPageToken으로 반복 호출.
export type BackfillResult = {
  folder: string;
  processed: number;
  resized: number;
  skipped: number;
  failed: number;
  bytesBefore: number;
  bytesAfter: number;
  savedMB: string;
  nextPageToken: string; // 빈 문자열이면 끝
  errors?: string[];
};
export async function backfillImages(
  folder: 'recipeImages' | 'profileImages' | 'reviewImages',
  pageToken?: string,
  limit = 30
): Promise<BackfillResult> {
  const params = new URLSearchParams({ folder, limit: String(limit) });
  if (pageToken) params.set('pageToken', pageToken);
  return request<BackfillResult>(`/api/upload/backfill?${params.toString()}`, { method: 'POST' });
}

// ── Gifticon ──

export type Gifticon = {
  id: string;
  name: string;
  brand: string;
  image: string;
  pointCost: number;
  category: string;
  description: string;
  stock: number;
  active: boolean;
};

export type PointHistory = {
  id: string;
  uid: string;
  type: 'earn' | 'spend';
  amount: number;
  title: string;
  description: string;
  gifticonId?: string;
  createdAt: string;
};

export async function fetchGifticons(): Promise<Gifticon[]> {
  const cached = getCached<Gifticon[]>('gifticons');
  if (cached) return cached;
  const data = await request<Gifticon[]>('/api/gifticons');
  setCache('gifticons', data);
  return data;
}

// ── Search ──

export type TrendingKeyword = {
  keyword: string;
  rank: number;
  isNew: boolean;
  change: 'up' | 'down' | 'same';
  category?: string;
};

export async function fetchTrendingKeywords(): Promise<TrendingKeyword[]> {
  try {
    return await request<TrendingKeyword[]>('/api/search/trending');
  } catch {
    return [];
  }
}

export async function fetchRecommendedKeywords(): Promise<string[]> {
  try {
    return await request<string[]>('/api/search/recommended');
  } catch {
    return [];
  }
}

export async function logSearch(keyword: string, type: 'all' | 'recipe' | 'shop' | 'community' = 'all'): Promise<void> {
  try {
    await request('/api/search/log', { method: 'POST', body: JSON.stringify({ keyword, type }) });
  } catch {}
}

export async function exchangeGifticon(uid: string, gifticonId: string, phoneNo?: string): Promise<Gifticon> {
  // 교환 시 재고/잔여수량 변경될 수 있으므로 목록 캐시 무효화
  invalidateCache('gifticons');
  return request<Gifticon>('/api/gifticons/exchange', {
    method: 'POST',
    body: JSON.stringify({ uid, gifticonId, phoneNo }),
  });
}

export async function fetchPointHistory(uid: string): Promise<PointHistory[]> {
  return request<PointHistory[]>(`/api/users/${encodeURIComponent(uid)}/point-history`);
}
