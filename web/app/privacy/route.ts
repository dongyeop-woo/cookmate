/**
 * 개인정보처리방침 — Notion 공개 페이지로 redirect.
 * (백엔드 ShareController.privacyRedirect 와 동일한 URL)
 */
export const runtime = 'edge';

export async function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: 'https://tame-impatiens-537.notion.site/349265f9e0178008a026f1bf668df65e',
      'Cache-Control': 'no-store',
    },
  });
}
