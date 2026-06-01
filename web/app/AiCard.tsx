import OpenAppButton from './OpenAppButton';

/**
 * AI 추천 진입 카드 — 앱의 aiRecommendCard 동일 (그라데이션 보더 + 흰 카드 + 아이콘 + 텍스트).
 * 웹에선 클릭 시 앱 딥링크 (yojalal://ai-recommend) 시도, 미설치면 스토어로.
 */
export default function AiCard() {
  return (
    <OpenAppButton path="ai-recommend" className="ai-card">
      <span className="ai-icon">✨</span>
      <span className="ai-text">오늘 뭐 먹지? AI 셰프에게 물어보기</span>
      <span className="ai-arrow">→</span>
    </OpenAppButton>
  );
}
