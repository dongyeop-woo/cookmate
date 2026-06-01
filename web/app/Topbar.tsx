import OpenAppButton from './OpenAppButton';

export default function Topbar() {
  return (
    <header className="topbar">
      <a className="logo" href="/">
        <span className="leaf">🌱</span>요잘알
      </a>
      <OpenAppButton className="open-mini" path="">앱 열기</OpenAppButton>
    </header>
  );
}
