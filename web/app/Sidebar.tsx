import SidebarLogin from './SidebarLogin';
import ChefAvatar from './ChefAvatar';
import AppDownloadModal from './AppDownloadModal';
import { Recipe, UserProfile, CATEGORIES, formatTime } from '@/lib/api';

const FALLBACK = '/img/app-icon.png';

type Props = {
  todayPick: Recipe[];
  popular: Recipe[];
  topUsers?: UserProfile[];
  authorImages?: Record<string, string>;
};

/**
 * 데스크톱 우측 사이드바.
 * 박스: 로그인 / 앱 다운로드 / 오늘의 추천 / Top 셰프 / 카테고리 / 인기 TOP 5
 */
export default function Sidebar({ todayPick, popular, topUsers = [], authorImages = {} }: Props) {
  return (
    <aside className="sidebar">
      {/* 로그인 박스 (클라이언트 컴포넌트, auth state 반영) */}
      <SidebarLogin />

      {/* 앱 설치 프로모 박스 */}
      <div className="side-box">
        <div className="side-promo">
          <img src="/img/appIcon-padded.png" alt="요잘알" className="side-promo-icon" />
          <div className="side-promo-text">
            <div className="side-promo-title">요잘알 앱에서 더 편하게</div>
            <div className="side-promo-sub">음성 모드 · 자동 타이머 · AI 추천</div>
          </div>
        </div>
        <AppDownloadModal className="side-promo-btn">앱 다운로드</AppDownloadModal>
      </div>

      {/* 오늘의 추천 */}
      {todayPick.length > 0 && (
        <div className="side-box">
          <div className="side-header"><h3 className="side-title">오늘의 추천</h3></div>
          <ul className="side-list">
            {todayPick.slice(0, 5).map((r, i) => (
              <li key={r.id}>
                <a className="side-item" href={`/recipe/${r.id}`}>
                  <span className="side-rank">{i + 1}</span>
                  <img className="side-thumb" src={r.image || FALLBACK} alt={r.title} loading="lazy" />
                  <div className="side-item-body">
                    <div className="side-item-title">{r.title}</div>
                    <div className="side-item-meta">
                      <span>⏱ {formatTime(r.time)}분</span>
                      <span className="side-sep">·</span>
                      <span className="side-heart">♥ {r.likes ?? 0}</span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Top 셰프 */}
      {topUsers.length > 0 && (
        <div className="side-box">
          <div className="side-header"><h3 className="side-title">Top 셰프</h3></div>
          <ul className="side-chef-list">
            {topUsers.slice(0, 6).map((u) => (
              <li key={u.uid ?? u.nickname}>
                <div className="side-chef side-chef-static">
                  <ChefAvatar
                    className="side-chef-avatar"
                    profileImage={u.profileImage}
                    gender={u.gender}
                    alt={u.nickname ?? ''}
                  />
                  <div className="side-chef-body">
                    <div className="side-chef-name">
                      {u.nickname ?? '회원'}
                      {u.role === 'admin' && <span className="side-chef-badge">관리자</span>}
                    </div>
                    <div className="side-chef-meta">
                      레시피 {u.recipeCount ?? 0} · ♥ {u.totalLikes ?? 0}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 카테고리 모음 */}
      <div className="side-box">
        <div className="side-header"><h3 className="side-title">카테고리</h3></div>
        <div className="side-cat-grid">
          {CATEGORIES.map((c) => (
            <a key={c.name} className="side-cat-item" href={`/category/${encodeURIComponent(c.name)}`}>
              <img src={`/img/${c.icon}`} alt={c.name} loading="lazy" />
              <span>{c.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* 인기 TOP 5 */}
      {popular.length > 0 && (
        <div className="side-box">
          <div className="side-header">
            <h3 className="side-title">인기 TOP 5</h3>
            <span className="side-badge">🔥</span>
          </div>
          <ul className="side-list">
            {popular.slice(0, 5).map((r, i) => (
              <li key={r.id}>
                <a className="side-item" href={`/recipe/${r.id}`}>
                  <span className={`side-rank ${i < 3 ? 'side-rank-hot' : ''}`}>{i + 1}</span>
                  <img className="side-thumb" src={r.image || FALLBACK} alt={r.title} loading="lazy" />
                  <div className="side-item-body">
                    <div className="side-item-title">{r.title}</div>
                    <div className="side-item-meta">
                      <span className="side-heart">♥ {r.likes ?? 0}</span>
                      <span className="side-sep">·</span>
                      <span>{r.author ?? ''}</span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
