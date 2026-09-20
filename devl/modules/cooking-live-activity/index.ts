import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export interface LiveActivityDiagnosis {
  iosVersion: string;
  isLowPowerMode: boolean;
  areActivitiesEnabled: boolean;
  frequentPushesEnabled?: boolean;
}

interface CookingLiveActivityNative {
  isSupported(): Promise<boolean>;
  diagnose(): Promise<LiveActivityDiagnosis>;
  start(
    recipeTitle: string,
    stepNumber: number,
    totalSteps: number,
    remainingSeconds: number
  ): Promise<string | null>;
  pause(remainingSeconds: number): Promise<void>;
  resume(remainingSeconds: number): Promise<void>;
  end(): Promise<void>;
  endAll(): Promise<void>;
}

// iOS: ActivityKit 기반 Live Activity. Android: Notification + Chronometer 기반.
// 둘 다 동일한 API 표면을 제공해 JS 측 코드는 플랫폼 분기 불필요.
// Expo Go나 native 미빌드 환경에서는 모듈이 없으므로 noop으로 안전 폴백.
const native = (Platform.OS === 'ios' || Platform.OS === 'android')
  ? requireOptionalNativeModule<CookingLiveActivityNative>('CookingLiveActivity')
  : null;

// 진단 로그 — 모듈이 native 측에 등록됐는지 확인. native=null이면 Kotlin 빌드 실패.
if (__DEV__) {
  console.log('[CookingLiveActivity] platform:', Platform.OS, 'native:', native ? 'LOADED' : 'NULL (noop fallback)');
}

const noop = async () => {};
const noopReturn = async () => null;
const noopBool = async () => false;
const noopDiagnose = async (): Promise<LiveActivityDiagnosis> => ({
  iosVersion: 'n/a',
  isLowPowerMode: false,
  areActivitiesEnabled: false,
});

// 각 메서드를 한 단계씩 더 보호 — 이전 native 빌드에 새 함수가 없을 때
// (예: diagnose 추가 후 native 재빌드 전 dev 환경) bind 단계에서 throw 나지 않도록.
export const CookingLiveActivity = {
  isSupported: native?.isSupported?.bind(native) ?? noopBool,
  diagnose: native?.diagnose?.bind(native) ?? noopDiagnose,
  start: native?.start?.bind(native) ?? noopReturn,
  pause: native?.pause?.bind(native) ?? noop,
  resume: native?.resume?.bind(native) ?? noop,
  end: native?.end?.bind(native) ?? noop,
  endAll: native?.endAll?.bind(native) ?? noop,
};
