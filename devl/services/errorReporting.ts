/**
 * 에러 리포팅 래퍼 — 현재는 console만 사용. 프로덕션 출시 전 Sentry 연동 권장.
 *
 * 연동 방법 (5분):
 * 1. `npx expo install sentry-expo @sentry/react-native`
 * 2. sentry-expo 플러그인 app.json 에 추가
 * 3. 아래 init() 내부 주석 해제 후 DSN 교체
 * 4. EAS build 시 `EXPO_PUBLIC_SENTRY_DSN` 환경변수 설정
 *
 * DSN 발급: https://sentry.io → Project → Settings → Client Keys
 */

type ErrorLike = Error | unknown;

let initialized = false;

export function initErrorReporting(): void {
  if (initialized) return;
  initialized = true;

  // TODO: Sentry 연동 시 아래 블록 활성화
  // try {
  //   const Sentry = require('sentry-expo');
  //   Sentry.init({
  //     dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  //     enableInExpoDevelopment: false, // 개발 모드엔 끔
  //     debug: __DEV__,
  //     tracesSampleRate: 0.1, // 10% 성능 샘플링
  //   });
  // } catch (e) {
  //   console.warn('Sentry 초기화 실패:', e);
  // }
}

/** 예상치 못한 에러 보고. try/catch의 catch 블록에서 호출. */
export function reportError(error: ErrorLike, context?: Record<string, any>): void {
  if (__DEV__) {
    console.error('[errorReporting]', error, context);
  }
  // TODO: Sentry 연동 후
  // try {
  //   const Sentry = require('sentry-expo').Native;
  //   if (context) Sentry.setContext('extra', context);
  //   Sentry.captureException(error);
  // } catch {}
}

/** 유저 식별 (에러와 유저 연결). 로그인 성공 직후 호출. */
export function setErrorUser(uid: string | null, email?: string): void {
  // TODO: Sentry 연동 후
  // try {
  //   const Sentry = require('sentry-expo').Native;
  //   if (uid) Sentry.setUser({ id: uid, email });
  //   else Sentry.setUser(null);
  // } catch {}
}
