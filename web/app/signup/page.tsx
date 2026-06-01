import type { Metadata } from 'next';
import Topbar from '../Topbar';
import Footer from '../Footer';
import SignupForm from './SignupForm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '회원가입',
  description: '요잘알 회원가입',
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <>
      <Topbar />
      <main>
        <div className="auth-wrap">
          <div className="auth-card">
            <img className="auth-logo" src="/img/appIcon-padded.png" alt="요잘알" />
            <h1 className="auth-title">프로필을<br />완성해주세요</h1>
            <p className="auth-sub">닉네임을 정하고 시작해보세요</p>
            <SignupForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
