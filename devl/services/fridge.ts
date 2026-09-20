import { authInstance } from '../firebase';
import { authFetch } from './api';

const BASE_URL = 'https://yojalal.com';

/**
 * 유저별 냉장고 데이터. 백엔드(Firestore) 저장 — 기기 간 동기화.
 */
export type StorageType = 'fridge' | 'freezer';

export type FridgeItem = {
  id: string;
  name: string;
  icon: string;
  imageUrl?: string;
  addedAt: string;
  expiresAt: string;
  quantity?: string;
  storage?: StorageType;
  notificationIds?: string[];
  /** 유저가 직접 입력한 커스텀 재료 여부. HACCP/식약처 검색 선택은 false. */
  isCustom?: boolean;
  /** 원본 소스 키 — HACCP은 prdlstReportNo, curated는 "common:..." */
  sourceKey?: string;
};

function currentUid(): string | null {
  return authInstance.currentUser?.uid ?? null;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await authFetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as unknown as T);
}

async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API ${res.status}` }));
    throw new Error(err.error || `API ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as unknown as T);
}

export async function getFridge(): Promise<FridgeItem[]> {
  const uid = currentUid();
  if (!uid) return [];
  try {
    const items = await apiGet<FridgeItem[]>(`/api/fridge/items?uid=${encodeURIComponent(uid)}`);
    return (items || []).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  } catch {
    return [];
  }
}

export async function addFridgeItem(
  item: Omit<FridgeItem, 'id' | 'addedAt'>
): Promise<FridgeItem> {
  const uid = currentUid();
  if (!uid) throw new Error('로그인이 필요합니다');
  return apiSend<FridgeItem>(`/api/fridge/items?uid=${encodeURIComponent(uid)}`, 'POST', item);
}

export async function updateFridgeItem(
  id: string,
  updates: Partial<Omit<FridgeItem, 'id' | 'addedAt'>>
): Promise<FridgeItem | null> {
  const uid = currentUid();
  if (!uid) return null;
  try {
    return await apiSend<FridgeItem>(
      `/api/fridge/items/${encodeURIComponent(id)}?uid=${encodeURIComponent(uid)}`,
      'PATCH',
      updates
    );
  } catch {
    return null;
  }
}

export async function removeFridgeItem(id: string): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    await apiSend(`/api/fridge/items/${encodeURIComponent(id)}?uid=${encodeURIComponent(uid)}`, 'DELETE');
  } catch {}
}

export async function clearFridge(): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    await apiSend(`/api/fridge/items?uid=${encodeURIComponent(uid)}`, 'DELETE');
  } catch {}
}

/** 같은 이름의 재료가 이미 냉장고에 있는지 조회 (대소문자/공백 무시) */
export async function findDuplicate(name: string): Promise<FridgeItem | null> {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized) return null;
  const list = await getFridge();
  return list.find(i => i.name.trim().toLowerCase().replace(/\s+/g, '') === normalized) ?? null;
}

/** 유효기간 체크 유틸 */
export function daysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiresAt);
  expiry.setHours(0, 0, 0, 0);
  const diff = expiry.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** 상태 분류 (기본 기준): 'expired' | 'urgent'(0~1일) | 'soon'(2~3일) | 'ok' */
export function getExpiryStatus(expiresAt: string): 'expired' | 'urgent' | 'soon' | 'ok' {
  const d = daysUntilExpiry(expiresAt);
  if (d < 0) return 'expired';
  if (d <= 1) return 'urgent';
  if (d <= 3) return 'soon';
  return 'ok';
}

/** 유저 설정 기반 상태 분류 */
export function getExpiryStatusWith(
  expiresAt: string,
  urgentDays: number,
  soonDays: number
): 'expired' | 'urgent' | 'soon' | 'ok' {
  const d = daysUntilExpiry(expiresAt);
  if (d < 0) return 'expired';
  if (d <= urgentDays) return 'urgent';
  if (d <= soonDays) return 'soon';
  return 'ok';
}

/**
 * 아이템의 보관 위치를 결정.
 * 저장된 storage가 있으면 그대로, 없으면 유효기간 기반 자동 분류 (14일 초과 → 냉동실).
 */
export function resolveStorage(item: FridgeItem): StorageType {
  if (item.storage) return item.storage;
  return daysUntilExpiry(item.expiresAt) > 14 ? 'freezer' : 'fridge';
}

export async function moveFridgeItem(id: string, storage: StorageType): Promise<FridgeItem | null> {
  return updateFridgeItem(id, { storage });
}
