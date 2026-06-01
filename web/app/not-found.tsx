import type { Metadata } from 'next';
import Topbar from './Topbar';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Topbar />
      <main className="content">
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍳</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
            페이지를 찾을 수 없어요
          </h1>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
            삭제되었거나 잘못된 링크일 수 있어요.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block', background: '#0B9A61', color: '#fff',
              padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14,
            }}
          >
            요잘알 홈으로
          </a>
        </div>
      </main>
    </>
  );
}
