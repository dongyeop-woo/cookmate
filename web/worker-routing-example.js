/**
 * yojalal-proxy Cloudflare Worker — 정적/동적 라우팅 분기.
 *
 * 정적 페이지 (Cloudflare Pages 가 처리):
 *   /, /category/*, /recipe/*, /img/*, /_next/*, /sitemap.xml, /robots.txt(선택)
 *
 * 동적 API + 레거시 redirect (Cloud Run 백엔드):
 *   /api/*, /privacy, /terms, /support, /about, /yojalal (랜딩),
 *   /app-ads.txt, /.well-known/*, /profile/*
 *
 * 사용:
 *   1. Cloudflare 대시보드 → yojalal-proxy 워커 → Edit code
 *   2. 아래 코드 전체로 교체
 *   3. Save and Deploy
 *
 * Cloudflare Pages 프로젝트는 yojalal.pages.dev 형태의 기본 도메인을 가짐.
 * Custom domain 으로 yojalal.com 직접 연결할 수도 있지만,
 * worker로 분기하는 게 점진적 마이그레이션에 유연함.
 */

const CLOUD_RUN = 'devl-backend-879574205436.asia-northeast3.run.app';
const PAGES_ORIGIN = 'yojalal.pages.dev'; // Cloudflare Pages 프로젝트 기본 도메인
const PUBLIC_HOST = 'yojalal.com';

// Pages 가 서빙하는 경로 (정규식)
const PAGES_PATHS = [
  /^\/$/,
  /^\/category(\/|$)/,
  /^\/recipe(\/|$)/,
  /^\/img(\/|$)/,
  /^\/_next(\/|$)/,
  /^\/sitemap\.xml$/,
  /^\/favicon\.ico$/,
  /^\/manifest\.json$/,
];

function shouldGoToPages(pathname) {
  return PAGES_PATHS.some((re) => re.test(pathname));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = shouldGoToPages(url.pathname) ? PAGES_ORIGIN : CLOUD_RUN;

    const proxyUrl = new URL(request.url);
    proxyUrl.hostname = target;
    proxyUrl.protocol = 'https:';
    proxyUrl.port = '';

    const headers = new Headers(request.headers);
    headers.set('Host', target);
    headers.set('X-Forwarded-Host', PUBLIC_HOST);
    headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
    headers.set('X-Forwarded-Proto', 'https');

    const proxied = new Request(proxyUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    });

    const response = await fetch(proxied);

    // Cloud Run에서 Location 헤더로 redirect 보낼 때 호스트 갈아끼움.
    if (response.status >= 300 && response.status < 400) {
      const loc = response.headers.get('Location');
      if (loc) {
        try {
          const t = new URL(loc, proxyUrl.toString());
          if (t.hostname === CLOUD_RUN || t.hostname === PAGES_ORIGIN) {
            t.hostname = PUBLIC_HOST;
            const newHeaders = new Headers(response.headers);
            newHeaders.set('Location', t.toString());
            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
          }
        } catch {}
      }
    }

    return response;
  },
};
