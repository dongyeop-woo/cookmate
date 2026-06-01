/**
 * QR 스캔 또는 직접 접속 시 OS 감지하여 알맞은 스토어로 redirect.
 *  - iOS    → App Store
 *  - Android → Google Play
 *  - 데스크톱 → yojalal.com 홈으로 (QR로 들어올 일 없음, 안전망)
 *
 * Edge runtime — 빠른 redirect, Cloudflare Pages 호환.
 */
export const runtime = 'edge';

const APP_STORE = 'https://apps.apple.com/kr/app/%EC%9A%94%EC%9E%98%EC%95%8C/id6761661890';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.dyw.cookmate';
const HOME = 'https://yojalal.com/';

export async function GET(request: Request) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const isAndroid = ua.includes('android');
  const isIOS = /iphone|ipad|ipod/.test(ua);

  const target = isAndroid ? PLAY_STORE : isIOS ? APP_STORE : HOME;

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
    },
  });
}
