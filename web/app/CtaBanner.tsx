import OpenAppButton from './OpenAppButton';

type Props = { title?: string; sub?: string; path?: string };

export default function CtaBanner({
  title = '앱에서 음성 모드로 더 편하게',
  sub = '단계별 자동 타이머 · AI 메뉴 추천',
  path = '',
}: Props) {
  return (
    <>
      {/* 고정 배너가 푸터를 덮지 않도록 문서 끝에 여백 확보 (모바일엔 body padding 이 없음) */}
      <div className="cta-banner-spacer" aria-hidden="true" />
      <div className="cta-banner">
        <div className="cta-banner-inner">
          <div className="cta-msg">
            <b>{title}</b>
            <span>{sub}</span>
          </div>
          <OpenAppButton className="cta-btn" path={path}>앱 열기</OpenAppButton>
        </div>
      </div>
    </>
  );
}
