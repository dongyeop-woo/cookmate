import * as Application from 'expo-application';
import { Platform, Linking } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

type VersionInfo = {
  minVersion: string;
  latestVersion: string;
  storeUrl: string;
};

type VersionResponse = {
  ios: VersionInfo;
  android: VersionInfo;
};

/** "1.2.3" → [1, 2, 3]. 비교용 배열 반환. */
function parseVersion(v: string): number[] {
  return v.split('.').map((x) => parseInt(x, 10) || 0);
}

/** a < b 이면 true */
function isLessThan(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

export type VersionCheckResult =
  | { status: 'ok' }
  | { status: 'update-recommended'; storeUrl: string; latest: string }
  | { status: 'force-update'; storeUrl: string; required: string };

/**
 * 서버에서 min/latest 버전 조회 후 현재 앱 버전과 비교.
 * 네트워크 실패 시 'ok'로 간주 — 서버 장애로 앱을 막지는 않음.
 */
export async function checkAppVersion(): Promise<VersionCheckResult> {
  try {
    const current = Application.nativeApplicationVersion || '1.0.0';
    const res = await fetch(`${BASE_URL}/api/app/version`);
    if (!res.ok) return { status: 'ok' };
    const data: VersionResponse = await res.json();
    const info = Platform.OS === 'ios' ? data.ios : data.android;
    if (isLessThan(current, info.minVersion)) {
      return { status: 'force-update', storeUrl: info.storeUrl, required: info.minVersion };
    }
    if (isLessThan(current, info.latestVersion)) {
      return { status: 'update-recommended', storeUrl: info.storeUrl, latest: info.latestVersion };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'ok' };
  }
}

export function openStore(url: string): void {
  Linking.openURL(url).catch(() => {});
}
