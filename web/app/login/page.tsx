import type { Metadata } from 'next';
import Topbar from '../Topbar';
import Footer from '../Footer';
import LoginButtons from './LoginButtons';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '로그인 / 회원가입',
  description: '요잘알 로그인 또는 회원가입',
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <>
      <Topbar />
      <main>
        <div className="auth-wrap">
          <div className="auth-card">
            <img className="auth-logo" src="/img/appIcon-padded.png" alt="요잘알" />
            <h1 className="auth-title">요잘알에 오신 것을<br />환영합니다</h1>
            <p className="auth-sub">소셜 계정으로 빠르게 시작해보세요</p>
            <LoginButtons />
            <p className="auth-terms">
              가입 시 <a href="/terms">이용약관</a> 및 <a href="/privacy">개인정보처리방침</a>에 동의하게 됩니다.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
