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

// iOS 외 플랫폼/Expo Go에서는 모듈이 없을 수 있음 — no-op으로 안전 폴백.
const native = Platform.OS === 'ios'
  ? requireOptionalNativeModule<CookingLiveActivityNative>('CookingLiveActivity')
  : null;

const noop = async () => {};
const noopReturn = async () => null;
const noopBool = async () => false;
const noopDiagnose = async (): Promise<LiveActivityDiagnosis> => ({
  iosVersion: 'n/a',
  isLowPowerMode: false,
  areActivitiesEnabled: false,
});

export const CookingLiveActivity = {
  isSupported: native?.isSupported.bind(native) ?? noopBool,
  diagnose: native?.diagnose.bind(native) ?? noopDiagnose,
  start: native?.start.bind(native) ?? noopReturn,
  pause: native?.pause.bind(native) ?? noop,
  resume: native?.resume.bind(native) ?? noop,
  end: native?.end.bind(native) ?? noop,
  endAll: native?.endAll.bind(native) ?? noop,
};
