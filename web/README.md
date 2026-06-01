# 요잘알 웹 (yojalal.com)

Next.js App Router 정적/하이브리드 SSR 사이트. Cloudflare Pages에 배포.
Cloud Run 백엔드의 `/api/*` 를 호출해 데이터 가져옴.

## 빠른 시작

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

저장하면 hot reload, 1초 안에 반영.

## 환경변수

`.env.local` 만들어서 오버라이드 가능. 기본값:

```
NEXT_PUBLIC_API_BASE=https://yojalal.com
```

로컬에서 백엔드도 같이 띄울 거면:
```
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

## 배포 (Cloudflare Pages)

### 첫 셋업 (1회)

1. **GitHub repo 만들기 / 푸시**
   - 새 repo 또는 기존 repo의 `/web/` 폴더를 그대로 사용
2. **Cloudflare 대시보드 → Workers & Pages → Pages 탭 → "Connect to Git"**
3. **Repo 선택 → 빌드 설정:**
   - Framework preset: **Next.js**
   - Build command: `npm run pages:build`
   - Build output directory: `.vercel/output/static`
   - Root directory: `/web` (모노레포면)
   - Node version: `20`
4. **Environment variable (production)**:
   - `NEXT_PUBLIC_API_BASE` = `https://yojalal.com`
   - `NODE_VERSION` = `20`
5. **Save and Deploy**

### 매번 배포 (자동)

```bash
git add . && git commit -m "..." && git push
```
→ Cloudflare가 감지하고 자동 빌드/배포 (20~40초)

### 수동 배포 (선택)

```bash
npm run pages:deploy
```
wrangler CLI로 직접 업로드.

## yojalal.com 도메인 연결

Cloudflare 대시보드:
1. Pages 프로젝트 → Custom domains → "Set up a custom domain"
2. `yojalal.com` 입력
3. 기존 yojalal-proxy worker 라우팅과 충돌 안 나게 정리 필요:
   - `/api/*`, `/recipe/{id}` (HTML), `/sitemap.xml` 등 동적 경로 → Cloud Run
   - 나머지 (/, /category/*, /recipe/*) → Cloudflare Pages

자세한 라우팅은 [Cloudflare Worker 설정](#worker-routing) 참고.

## Worker Routing

기존 `yojalal-proxy` 워커 코드를 다음처럼 분기:

```js
const PAGES_ORIGIN = 'yojalal.pages.dev';
const CLOUD_RUN = 'devl-backend-879574205436.asia-northeast3.run.app';

// 정적 사이트가 처리하는 경로 (Cloudflare Pages 로 라우팅)
const PAGES_PATHS = [/^\/$/, /^\/category\//, /^\/recipe\//, /^\/img\//, /^\/_next\//, /^\/sitemap\.xml$/, /^\/robots\.txt$/];

// 위 외에는 모두 Cloud Run (API + 기존 redirect/legal)
```

## 디렉터리

```
web/
├── app/
│   ├── layout.tsx              루트 레이아웃 + 메타
│   ├── page.tsx                홈 /
│   ├── globals.css             앱 톤 그대로 옮긴 CSS
│   ├── Topbar.tsx              상단바
│   ├── Footer.tsx              하단 푸터
│   ├── CtaBanner.tsx           앱 설치 CTA
│   ├── OpenAppButton.tsx       딥링크 열기 버튼 (client)
│   ├── RecipeCard.tsx          레시피 카드
│   ├── category/[name]/page.tsx 카테고리 페이지
│   ├── recipe/[id]/page.tsx    레시피 상세 + Schema.org JSON-LD
│   ├── not-found.tsx           404
│   └── sitemap.ts              sitemap.xml 자동 생성
├── lib/
│   └── api.ts                  Cloud Run API 클라이언트 + 타입
├── public/
│   └── img/                    카테고리 PNG 아이콘 + 앱 아이콘
├── next.config.js
├── tsconfig.json
└── package.json
```

## 작업 흐름 (앞으로)

CSS / HTML 자잘한 수정:
1. `npm run dev` 켜놓고 코드 수정 → 즉시 확인
2. 마음에 들면 `git push` → 30초 후 yojalal.com 반영

백엔드 데이터/API 변경:
- 기존대로 `gcloud run deploy ...` (Cloud Run)
