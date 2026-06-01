import type { Metadata } from 'next';
import Topbar from '../Topbar';
import Footer from '../Footer';
import AppDownloadModal from '../AppDownloadModal';

export const metadata: Metadata = {
  title: '요잘알 앱 리뷰 이벤트',
  description: '요잘알에 리뷰를 남기고 신세계 상품권 등 푸짐한 경품을 받아가세요.',
  openGraph: {
    title: '요잘알 앱 리뷰 이벤트',
    description: '리뷰 작성하고 상품권 받기',
    images: ['/img/test.png'],
  },
};

const PRIZES = [
  { rank: '1등', bg: '#FFD700', name: '신세계 상품권 5만원', count: '1명' },
  { rank: '2등', bg: '#C0C0C0', name: '신세계 상품권 1만원', count: '5명' },
  { rank: '3등', bg: '#CD7F32', name: '요잘알 포인트 1,000P', count: '100명' },
];

const NOTICES = [
  'Google Play Store 또는 App Store에 기간 내에 앱 리뷰를 남겨야만 이벤트 참여가 가능합니다.',
  '이벤트 참여 인원에 따라 당첨 경품 및 인원이 추가 증정될 수 있습니다.',
  '상품 발송 시점에 작성한 리뷰 확인이 불가할 경우, 상품 수여 대상에서 제외됩니다.',
  '이벤트 참여 시 작성해주신 리뷰는 요잘알 마케팅 활용 목적으로 사용될 수 있으며, 이벤트 응모 시 이에 동의한 것으로 간주합니다.',
  '이벤트 응모 시 오기재 된 정보 및 휴대폰 설정으로 인한 경품 미제공은 당사가 책임지지 않습니다.',
  '이벤트 참여 시 욕설, 비방, 부적절하거나 타인에게 피해를 줄 수 있는 내용이 담겨 있는 리뷰는 사전 안내 없이 삭제 조치될 수 있습니다.',
  '당첨자 발표: 2026.07.07 앱 공지사항',
];

const PRIVACY = [
  '수집 및 이용 목적: 이벤트 운영 및 경품 발송',
  '수집 항목: 이름, 휴대폰 번호, 리뷰 작성 캡처 이미지 (앱스토어 닉네임, 리뷰 정보 포함)',
  '보유 및 이용기간: 당첨자 발표 후 1개월',
];

export default function EventReviewPage() {
  return (
    <>
      <Topbar />
      <main className="event-page">
        <img className="event-banner" src="/img/test.png" alt="요잘알 앱 리뷰 이벤트" />

        {/* 타이틀 섹션 */}
        <section className="event-title-section">
          <div className="event-label">[이벤트] 요잘알 앱 리뷰 이벤트</div>
          <div className="event-date">26.05.01</div>
          <h1 className="event-title">
            요잘알이<br />요리 재료 쏜다!
          </h1>
          <p className="event-subtitle">감사의 마음을 담아, 푸짐한 경품을 드려요</p>
          <div className="event-period-badge">26.05.01 (금) ~ 26.06.30 (화)</div>
        </section>

        {/* 인트로 */}
        <section className="event-intro">
          <p className="event-intro-text">
            요잘알과 함께 요리하며<br />
            즐거웠던 순간이 있었다면,<br />
            그 소중한 경험을 앱 리뷰로 나눠주세요!
          </p>
          <p className="event-intro-highlight">
            감사한 마음 가득 담아,<br />
            푸짐한 경품을 보내드리겠습니다.
          </p>
        </section>

        {/* 이벤트 기간 카드 */}
        <section className="event-card">
          <div className="event-badge">📅 이벤트 기간</div>
          <div className="event-card-label">참여 기간</div>
          <div className="event-card-value">26.05.01 (금) ~ 26.06.30 (화)</div>
        </section>

        {/* 참여 대상 */}
        <section className="event-card">
          <div className="event-badge">❓ 참여 대상</div>
          <div className="event-card-value">요잘알 가입 유저 전체</div>
        </section>

        {/* 경품 */}
        <section className="event-card">
          <div className="event-badge">🎁 이벤트 경품</div>
          <ul className="event-prizes">
            {PRIZES.map((p) => (
              <li key={p.rank} className="event-prize">
                <span className="event-prize-rank" style={{ background: p.bg }}>{p.rank}</span>
                <div className="event-prize-info">
                  <div className="event-prize-name">{p.name}</div>
                  <div className="event-prize-count">{p.count}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="event-prize-note">
            ※ 이벤트 참여 인원에 따라 경품 및 당첨 인원이 추가 증정될 수 있습니다.
          </p>
        </section>

        {/* 참여 방법 */}
        <section className="event-card">
          <div className="event-badge">❓ 참여 방법</div>

          <div className="event-step">
            <div className="event-step-label">STEP 1</div>
            <div className="event-step-title">스토어에 리뷰 작성</div>
          </div>
          <div className="event-step">
            <div className="event-step-label">STEP 2</div>
            <div className="event-step-title">작성한 리뷰 화면 캡처</div>
          </div>
          <div className="event-step">
            <div className="event-step-label">STEP 3</div>
            <div className="event-step-title">요잘알 앱 내 문의하기로 제출 완료!</div>
          </div>

          <AppDownloadModal className="event-participate-btn">
            앱에서 이벤트 참여하기
          </AppDownloadModal>
        </section>

        {/* 유의사항 */}
        <section className="event-notice">
          <h3 className="event-notice-title">꼭 확인해 주세요</h3>
          {NOTICES.map((n, i) => (
            <p key={i} className="event-notice-text">• {n}</p>
          ))}

          <h3 className="event-notice-title" style={{ marginTop: 20 }}>[개인정보 수집 및 이용 동의 안내]</h3>
          <p className="event-notice-text">
            이벤트 진행을 위해 아래와 같이 개인정보를 수집 및 이용합니다. 이벤트 참여 시에는 이에 동의한 것으로 간주합니다.
          </p>
          {PRIVACY.map((p, i) => (
            <p key={i} className="event-notice-text">• {p}</p>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
