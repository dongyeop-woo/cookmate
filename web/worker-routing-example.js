/**
 * yojalal-proxy Cloudflare Worker — 정적/동적 라우팅 분기.
 *
 * 기본: 모든 요청을 Cloudflare Pages (Next.js 사이트) 로 보냄.
 * 예외: 아래 CLOUDRUN_PATHS 에 매치되는 경로만 Cloud Run 백엔드로.
 *
 * 이렇게 하면 Next.js 에 새 페이지 추가할 때 워커를 안 건드려도 자동 라우팅됨.
 */

const CLOUD_RUN = 'devl-backend-879574205436.asia-northeast3.run.app';
const PAGES_ORIGIN = 'yojalal.pages.dev';
const PUBLIC_HOST = 'yojalal.com';

// Cloud Run 으로 가야 하는 경로 (이외는 모두 Pages)
const CLOUDRUN_PATHS = [
  /^\/api\//,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/support$/,
  /^\/about$/,
  /^\/yojalal$/,
  /^\/profile\//,
  /^\/app-ads\.txt$/,
  /^\/robots\.txt$/,
  /^\/\.well-known\//,
];

function shouldGoToCloudRun(pathname) {
  return CLOUDRUN_PATHS.some((re) => re.test(pathname));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = shouldGoToCloudRun(url.pathname) ? CLOUD_RUN : PAGES_ORIGIN;

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
