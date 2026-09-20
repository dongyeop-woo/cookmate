import { Platform } from 'react-native';
import mobileAds, { AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';

// iOS ATT 권한 요청 (앱 첫 실행 시 1회) + AdMob UMP 동의 폼 + AdMob 초기화
// UMP는 GDPR/EEA 대응이지만 비-EEA에선 자동으로 NOT_REQUIRED 반환되므로 부작용 없음.
// 호출 순서: UMP 먼저 → ATT → mobileAds.initialize (공식 권장 순서)
export async function initializeAdsAndTracking(): Promise<void> {
  try {
    await AdsConsent.requestInfoUpdate();
    const info = await AdsConsent.getConsentInfo();
    if (
      info.status === AdsConsentStatus.REQUIRED ||
      info.status === AdsConsentStatus.UNKNOWN
    ) {
      await AdsConsent.loadAndShowConsentFormIfRequired();
    }
  } catch (_) {
    // UMP 실패해도 앱 기동은 계속 — 비개인화 광고로 fallback
  }

  if (Platform.OS === 'ios') {
    try {
      // expo-tracking-transparency가 설치돼 있어야 동작. 미설치 시 graceful skip.
      const tt: any = require('expo-tracking-transparency');
      const current = await tt.getTrackingPermissionsAsync?.();
      if (current?.status === 'undetermined') {
        await tt.requestTrackingPermissionsAsync?.();
      }
    } catch (_) {
      // 모듈 미설치 — infoPlist의 NSUserTrackingUsageDescription이 있어도
      // 권한 요청 팝업은 뜨지 않음. Apple 심사 전 반드시 설치해야 함.
    }
  }

  try {
    await mobileAds().initialize();
  } catch (_) {}
}
