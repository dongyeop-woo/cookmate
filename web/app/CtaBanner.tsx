import OpenAppButton from './OpenAppButton';

type Props = { title?: string; sub?: string; path?: string };

export default function CtaBanner({
  title = '앱에서 음성 모드로 더 편하게',
  sub = '단계별 자동 타이머 · AI 메뉴 추천',
  path = '',
}: Props) {
  return (
    <div className="cta-banner">
      <div className="cta-banner-inner">
        <div className="cta-msg">
          <b>{title}</b>
          <span>{sub}</span>
        </div>
        <OpenAppButton className="cta-btn" path={path}>앱 열기</OpenAppButton>
      </div>
    </div>
  );
}
