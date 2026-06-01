/**
 * 이용약관 — Notion 공개 페이지로 redirect.
 * (백엔드 ShareController.termsRedirect 와 동일한 URL)
 */
export const runtime = 'edge';

export async function GET() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: 'https://tame-impatiens-537.notion.site/349265f9e01780a6bf15ed0a3edf22b1',
      'Cache-Control': 'no-store',
    },
  });
}
