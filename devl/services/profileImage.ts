/**
 * 프로필 이미지 URI가 실제로 다른 디바이스에서도 불러올 수 있는 "원격 이미지"인지 판정.
 *
 * 과거 일부 가입 흐름에서 `Image.resolveAssetSource(require(...)).uri` 결과가
 * Firestore에 저장됐는데, 이는 Metro dev 서버 URI(예: `http://localhost:8081/assets/...`)이거나
 * 프로덕션의 `asset://` 같은 값이라 다른 디바이스에서 불러올 수 없다.
 * `http://`로 시작하기 때문에 단순 startsWith('http') 체크로는 걸러지지 않는다.
 *
 * 이 함수는 그러한 잘못된 값을 걸러내고, 진짜 원격 CDN URL만 true를 반환한다.
 */
export function isRemoteProfileImage(uri?: string | null): boolean {
  if (!uri) return false;
  if (uri === 'default') return false;
  if (uri.trim() === '') return false;
  if (!(uri.startsWith('http://') || uri.startsWith('https://'))) return false;

  // Metro dev 서버·로컬 IP 패턴 — 다른 디바이스에서 못 불러옴.
  const lower = uri.toLowerCase();
  if (lower.includes('localhost')) return false;
  if (lower.includes('127.0.0.1')) return false;
  if (lower.includes('10.0.2.2')) return false;
  if (/\/\/192\.168\./.test(lower)) return false;
  if (/\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(lower)) return false;
  if (lower.includes(':8081')) return false;
  if (lower.includes('/assets/?platform=')) return false;

  return true;
}
