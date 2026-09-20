import { authInstance } from '../firebase';
import { authFetch } from './api';

const BASE_URL = 'https://yojalal.com';

export type ExpiryColors = {
  urgent: string;
  soon: string;
  ok: string;
  expired: string;
};

export type FridgeSettings = {
  urgentDays: number;
  soonDays: number;
  colors: ExpiryColors;
};

export const DEFAULT_SETTINGS: FridgeSettings = {
  urgentDays: 1,
  soonDays: 3,
  colors: {
    urgent: '#FF3B30',
    soon: '#FF9500',
    ok: '#8E8E93',
    expired: '#FF3B30',
  },
};

export const COLOR_PRESETS: { key: string; label: string; colors: ExpiryColors }[] = [
  {
    key: 'default',
    label: '기본',
    colors: { urgent: '#FF3B30', soon: '#FF9500', ok: '#8E8E93', expired: '#FF3B30' },
  },
  {
    key: 'pastel',
    label: '파스텔',
    colors: { urgent: '#FF7A7A', soon: '#FFB347', ok: '#AAB4BE', expired: '#FF7A7A' },
  },
  {
    key: 'vivid',
    label: '비비드',
    colors: { urgent: '#E5007F', soon: '#FFAA00', ok: '#00A6A6', expired: '#E5007F' },
  },
  {
    key: 'mono',
    label: '모노톤',
    colors: { urgent: '#1A1A1A', soon: '#5A5A5F', ok: '#B5B5BE', expired: '#1A1A1A' },
  },
];

function currentUid(): string | null {
  return authInstance.currentUser?.uid ?? null;
}

export async function loadFridgeSettings(): Promise<FridgeSettings> {
  const uid = currentUid();
  if (!uid) return DEFAULT_SETTINGS;
  try {
    const res = await authFetch(`${BASE_URL}/api/fridge/settings?uid=${encodeURIComponent(uid)}`);
    if (!res.ok) return DEFAULT_SETTINGS;
    const text = await res.text();
    if (!text) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(text) as Partial<FridgeSettings>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    return {
      urgentDays: typeof parsed.urgentDays === 'number' ? parsed.urgentDays : DEFAULT_SETTINGS.urgentDays,
      soonDays: typeof parsed.soonDays === 'number' ? parsed.soonDays : DEFAULT_SETTINGS.soonDays,
      colors: { ...DEFAULT_SETTINGS.colors, ...(parsed.colors || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveFridgeSettings(settings: FridgeSettings): Promise<void> {
  const uid = currentUid();
  if (!uid) return;
  try {
    await authFetch(`${BASE_URL}/api/fridge/settings?uid=${encodeURIComponent(uid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch {}
}
