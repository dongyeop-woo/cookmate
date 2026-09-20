import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { syncPremium } from './api';

// RevenueCat 공개 SDK 키 — app.json `extra.revenueCat.iosKey/androidKey`에 설정.
// (프로덕션 키는 RevenueCat 대시보드에서 발급)
const rc = ((Constants.expoConfig?.extra as any)?.revenueCat) ?? {};
const REVENUECAT_IOS_KEY: string = rc.iosKey ?? '';
const REVENUECAT_ANDROID_KEY: string = rc.androidKey ?? '';

const PREMIUM_ENTITLEMENT = 'premium';
const PREMIUM_CACHE_KEY = '@is_premium';

let configuredUid: string | null = null;

/** 키가 비어있거나 placeholder면 RevenueCat 비활성화로 간주. */
function hasValidKey(): boolean {
  const key = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  return !!key && !key.startsWith('YOUR_') && !key.startsWith('test_');
}

/** RevenueCat 초기화 — 같은 uid로 중복 호출은 무시. */
export async function initPurchases(uid: string) {
  if (!hasValidKey()) return;
  if (configuredUid === uid) return;
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  try {
    await Purchases.configure({ apiKey, appUserID: uid });
    configuredUid = uid;
  } catch (e) {
    console.warn('[Premium] RevenueCat 초기화 실패:', e);
  }
}

/**
 * 로그아웃 시 호출 — RC appUserID 분리 + 로컬 캐시 클리어.
 * 이거 안 하면 다음에 다른 uid로 로그인해도 configuredUid 캐시 때문에
 * RC가 이전 사용자 entitlement를 새 사용자에게 적용할 수 있음.
 */
export async function logoutPurchases() {
  configuredUid = null;
  try {
    await AsyncStorage.removeItem(PREMIUM_CACHE_KEY);
  } catch {}
  if (!hasValidKey()) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut은 anonymous 상태에서 호출하면 throw — 무시
  }
}

function extractEntitlement(info: CustomerInfo) {
  const ent = info.entitlements.active[PREMIUM_ENTITLEMENT];
  return {
    isPremium: !!ent,
    expiresAt: ent?.expirationDate ?? null,
  };
}

/** RevenueCat에서 현재 구독 상태 확인 + 캐시 갱신. */
export async function checkPremiumStatus(): Promise<boolean> {
  if (!hasValidKey()) return getCachedPremiumStatus();
  try {
    const info = await Purchases.getCustomerInfo();
    const { isPremium } = extractEntitlement(info);
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, String(isPremium));
    return isPremium;
  } catch {
    const cached = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
    return cached === 'true';
  }
}

/**
 * 백엔드 Firestore와 프리미엄 상태 동기화.
 * 호출 시점: 앱 시작, 구매 완료, 복원 완료.
 * 백엔드는 이 값을 신뢰해서 user.isPremium 필드 갱신 → AI 추천 무제한 등 서버 기능 활성화.
 *
 * 일시적 네트워크 오류는 1회 재시도(2초 후). 실패 시 throws — 호출자가 사용자에게 안내.
 * TODO(prod): RevenueCat REST API 또는 웹훅으로 서버측 검증 추가 권장.
 */
async function syncToBackend(uid: string, isPremium: boolean, expiresAt: string | null): Promise<void> {
  try {
    await syncPremium(uid, isPremium, expiresAt);
  } catch (e) {
    console.warn('[Premium] 백엔드 동기화 1차 실패, 2초 후 재시도:', e);
    await new Promise(r => setTimeout(r, 2000));
    await syncPremium(uid, isPremium, expiresAt); // 2차 실패는 throws → 호출자 처리
  }
}

/**
 * 앱 시작 시 호출 — RC 상태를 읽고 백엔드와 mismatch면 보정.
 * 단, premiumSource='admin' 인 사용자는 보호 — 관리자 수동 부여를 RC가 덮어쓰지 않음.
 */
export async function syncPremiumOnLaunch(
  uid: string,
  currentBackendIsPremium: boolean,
  premiumSource?: 'admin' | 'revenuecat' | null,
): Promise<boolean> {
  // 관리자 부여 — RC sync 스킵, 백엔드 값 그대로 유지
  if (premiumSource === 'admin') {
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, String(currentBackendIsPremium));
    return currentBackendIsPremium;
  }
  if (!hasValidKey()) return currentBackendIsPremium;
  await initPurchases(uid);
  try {
    const info = await Purchases.getCustomerInfo();
    const { isPremium, expiresAt } = extractEntitlement(info);
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, String(isPremium));
    if (isPremium !== currentBackendIsPremium) {
      // 백엔드와 mismatch — 권위 있는 쪽(RC)으로 정정
      await syncToBackend(uid, isPremium, expiresAt);
    }
    return isPremium;
  } catch {
    return currentBackendIsPremium;
  }
}

/** 구독 상품 목록 가져오기. */
export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!hasValidKey()) return [];
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch {
    return [];
  }
}

export class BackendSyncFailedError extends Error {
  constructor() {
    super('결제는 완료됐지만 서버 동기화에 실패했어요. 잠시 후 앱을 재시작하면 자동 반영됩니다.');
    this.name = 'BackendSyncFailedError';
  }
}

/** 구독 구매 → 성공 시 백엔드 즉시 동기화. 백엔드 실패 시 BackendSyncFailedError throw (RC는 성공 상태 유지). */
export async function purchasePremium(uid: string, pkg: PurchasesPackage): Promise<boolean> {
  let isPremium = false;
  let expiresAt: string | null = null;
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const ent = extractEntitlement(customerInfo);
    isPremium = ent.isPremium;
    expiresAt = ent.expiresAt;
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, String(isPremium));
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e; // RC 결제 자체 실패 — 그대로 전파
  }
  if (isPremium) {
    try {
      await syncToBackend(uid, true, expiresAt);
    } catch {
      // RC 결제는 성공 → 다음 syncPremiumOnLaunch에서 자동 보정됨. UI에 안내만.
      throw new BackendSyncFailedError();
    }
  }
  return isPremium;
}

/** 구독 복원 → 성공 시 백엔드 즉시 동기화. */
export async function restorePurchases(uid: string): Promise<boolean> {
  let isPremium = false;
  let expiresAt: string | null = null;
  try {
    const info = await Purchases.restorePurchases();
    const ent = extractEntitlement(info);
    isPremium = ent.isPremium;
    expiresAt = ent.expiresAt;
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, String(isPremium));
  } catch {
    return false;
  }
  try {
    await syncToBackend(uid, isPremium, expiresAt);
  } catch {
    if (isPremium) throw new BackendSyncFailedError();
  }
  return isPremium;
}

/** 캐시된 프리미엄 상태 (빠른 확인용). */
export async function getCachedPremiumStatus(): Promise<boolean> {
  const cached = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
  return cached === 'true';
}
