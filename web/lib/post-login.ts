/**
 * 로그인 후 돌아갈 경로.
 * 좋아요처럼 특정 페이지에서 로그인을 유도한 경우 홈으로 튕기지 않게 한다.
 * 카카오는 리다이렉트 방식이라 URL 파라미터로는 유지가 안 되므로 sessionStorage 사용.
 */
const KEY = 'yj:postLoginRedirect';

export function setPostLoginRedirect(path: string) {
  try { sessionStorage.setItem(KEY, path); } catch {}
}

/** 저장된 경로를 꺼내면서 지운다. 없거나 외부 URL 이면 홈. */
export function takePostLoginRedirect(): string {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    // 오픈 리다이렉트 방지 — 같은 사이트 내부 경로만 허용
    if (v && v.startsWith('/') && !v.startsWith('//')) return v;
  } catch {}
  return '/';
}
