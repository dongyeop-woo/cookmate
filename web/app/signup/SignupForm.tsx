'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthProvider';
import { API_BASE } from '@/lib/api';

const TERMS_VERSION = '1.0.0';
const PRIVACY_VERSION = '1.0.0';

/**
 * 닉네임 + 성별 + 약관 동의 → 백엔드 createUser 호출.
 * 비로그인 상태로 들어오면 /login 으로 리다이렉트.
 */
export default function SignupForm() {
  const router = useRouter();
  const { firebaseUser, userProfile, loading, refreshProfile } = useAuth();

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 인증 안 됐으면 로그인 페이지로 / 이미 가입된 유저면 홈으로
  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace('/login'); return; }
    if (userProfile && !userProfile.withdrawnAt) { router.replace('/'); }
  }, [loading, firebaseUser, userProfile, router]);

  // 구글 프로필 닉네임 prefill
  useEffect(() => {
    if (firebaseUser?.displayName && !nickname) {
      setNickname(firebaseUser.displayName);
    }
  }, [firebaseUser]);

  const canSubmit = nickname.trim().length >= 2 && agreeTerms && agreePrivacy && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const now = new Date().toISOString();
      const body = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        nickname: nickname.trim(),
        phone: '',
        profileImage: firebaseUser.photoURL || 'default',
        bio: bio.trim(),
        gender,
        deviceId: undefined,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        termsAgreedAt: now,
        privacyAgreedAt: now,
        marketingAgreedAt: agreeMarketing ? now : null,
        birthYear: null,
      };
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `${res.status}`);
      }
      await refreshProfile();
      router.replace('/');
    } catch (e: any) {
      console.warn('Signup failed:', e);
      setError(e?.message || '회원가입에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !firebaseUser) {
    return <div className="auth-loading">잠시만 기다려주세요…</div>;
  }

  return (
    <form className="signup-form" onSubmit={submit}>
      <label className="signup-field">
        <span className="signup-label">닉네임 *</span>
        <input
          type="text"
          className="signup-input"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="2~16자"
          minLength={2}
          maxLength={16}
          required
          autoFocus
        />
      </label>

      <label className="signup-field">
        <span className="signup-label">자기소개</span>
        <textarea
          className="signup-input signup-textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="간단한 소개 (선택)"
          maxLength={200}
          rows={3}
        />
      </label>

      <div className="signup-field">
        <span className="signup-label">성별 (선택)</span>
        <div className="signup-radio-row">
          {(['', 'male', 'female'] as const).map((v) => (
            <label key={v} className="signup-radio">
              <input
                type="radio"
                name="gender"
                value={v}
                checked={gender === v}
                onChange={() => setGender(v)}
              />
              <span>{v === '' ? '선택 안 함' : v === 'male' ? '남성' : '여성'}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="signup-terms">
        <label className="signup-check">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} required />
          <span>(필수) <a href="/terms" target="_blank">이용약관</a>에 동의</span>
        </label>
        <label className="signup-check">
          <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} required />
          <span>(필수) <a href="/privacy" target="_blank">개인정보처리방침</a>에 동의</span>
        </label>
        <label className="signup-check">
          <input type="checkbox" checked={agreeMarketing} onChange={(e) => setAgreeMarketing(e.target.checked)} />
          <span>(선택) 마케팅 정보 수신 동의</span>
        </label>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <button type="submit" className="signup-submit" disabled={!canSubmit}>
        {submitting ? '가입 중…' : '회원가입 완료'}
      </button>
    </form>
  );
}
