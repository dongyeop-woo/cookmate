import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FridgeItem } from './fridge';
import type { FridgeSettings } from './fridgeSettings';

const NOTIF_KIND = 'fridge-expiry';
const CHANNEL_ID = 'fridge-expiry';
const FIRE_HOUR = 10;

type Bucket = 'today' | 'urgent' | 'soon';

function bodyFor(type: Bucket, count: number): string {
  if (type === 'today') return `오늘 만료 되는 재료가 ${count}개 있어요!`;
  if (type === 'urgent') return `임박한 재료가 ${count}개 있어요!`;
  return `곧 만료 되는 재료가 ${count}개 있어요!`;
}

async function ensurePermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: next } = await Notifications.requestPermissionsAsync();
  return next === 'granted';
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '냉장고 유효기간 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {}
}

/** 이전에 예약된 냉장고 알림을 모두 취소 (구버전 per-item 알림도 정리). */
async function cancelAllFridgeNotifications(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      const data = (n.content?.data as any) || {};
      if (data.kind === NOTIF_KIND || data.fridgeItemId) {
        try { await Notifications.cancelScheduledNotificationAsync(n.identifier); } catch {}
      }
    }
  } catch {}
}

/**
 * 냉장고 전체 재료 기준으로 알림을 재스케줄.
 *  - 오늘 만료(당일 10시): 항상
 *  - 임박(urgentDays 전 10시): urgentDays > 0
 *  - 곧 만료(soonDays 전 10시): soonDays > urgentDays
 * 같은 날짜 + 같은 종류에 걸리는 재료는 하나로 묶어 갯수만 표시.
 */
export async function rebuildExpiryNotifications(
  items: FridgeItem[],
  settings: FridgeSettings
): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;
  await ensureChannel();
  await cancelAllFridgeNotifications();

  const { urgentDays, soonDays } = settings;
  const buckets = new Map<string, { date: Date; type: Bucket; count: number }>();
  const now = Date.now();

  const addToBucket = (date: Date, type: Bucket) => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${type}`;
    const existing = buckets.get(key);
    if (existing) existing.count += 1;
    else buckets.set(key, { date, type, count: 1 });
  };

  for (const item of items) {
    const expiry = new Date(item.expiresAt);

    const todayTrigger = new Date(expiry);
    todayTrigger.setHours(FIRE_HOUR, 0, 0, 0);
    if (todayTrigger.getTime() > now) addToBucket(todayTrigger, 'today');

    if (urgentDays > 0) {
      const t = new Date(expiry);
      t.setDate(t.getDate() - urgentDays);
      t.setHours(FIRE_HOUR, 0, 0, 0);
      if (t.getTime() > now) addToBucket(t, 'urgent');
    }

    if (soonDays > urgentDays) {
      const t = new Date(expiry);
      t.setDate(t.getDate() - soonDays);
      t.setHours(FIRE_HOUR, 0, 0, 0);
      if (t.getTime() > now) addToBucket(t, 'soon');
    }
  }

  for (const { date, type, count } of buckets.values()) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '유통 기한 알림',
          body: bodyFor(type, count),
          data: { kind: NOTIF_KIND, route: '/my-fridge' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date,
          channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
        } as any,
      });
    } catch {}
  }
}

/** 구버전 per-item 알림 ID 취소 (호환용). */
export async function cancelNotifications(ids?: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
}
